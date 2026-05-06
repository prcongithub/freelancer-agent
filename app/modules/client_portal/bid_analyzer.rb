module ClientPortal
  class BidAnalyzer
    DEFAULT_MODEL = "global.anthropic.claude-haiku-4-5-20251001-v1:0".freeze

    def analyze(project:, bids:)
      return nil if bids.empty?
      prompt = build_prompt(project, bids)
      text   = call_bedrock(prompt)
      parse_response(text)
    rescue Aws::BedrockRuntime::Errors::ServiceError => e
      Rails.logger.error("ClientPortal::BidAnalyzer Bedrock error: #{e.class}: #{e.message}")
      nil
    rescue JSON::ParserError => e
      Rails.logger.error("ClientPortal::BidAnalyzer JSON parse error: #{e.message}")
      nil
    end

    private

    def build_prompt(project, bids)
      budget = project[:budget_range] || {}
      skills = (project[:skills_required] || []).join(", ")

      bids_text = bids.each_with_index.map do |bid, i|
        <<~BID
          Bid #{i + 1}:
            Bidder: #{bid[:bidder_name]}
            Amount: $#{bid[:amount]} #{budget[:currency] || "USD"}
            Delivery: #{bid[:delivery_days]} days
            Rating: #{bid[:bidder_rating] || "no rating"} (#{bid[:bidder_reviews]} reviews)
            Payment verified: #{bid[:payment_verified]}
            Proposal: #{bid[:proposal_text].to_s.truncate(300)}
        BID
      end.join("\n")

      <<~PROMPT
        You are helping a client evaluate freelance bids for their project.

        PROJECT:
        Title: #{project[:title]}
        Description: #{project[:description].to_s.truncate(500)}
        Budget: $#{budget[:min]}–$#{budget[:max]} #{budget[:currency] || "USD"}
        Skills required: #{skills}

        BIDS RECEIVED (#{bids.length} total):
        #{bids_text}

        Analyze these bids and return ONLY a JSON object (no markdown, no explanation outside the JSON).
        Select the top #{[bids.length, 5].min} bids and rank them. Score each 0-100.

        Respond with this exact structure:
        {
          "shortlist": [
            {
              "rank": <integer starting at 1>,
              "bidder_name": "<name>",
              "bid_amount": <number>,
              "score": <integer 0-100>,
              "strengths": ["<strength>"],
              "concerns": ["<concern>"],
              "summary": "<1 sentence>"
            }
          ]
        }

        Rank by: proposal quality and specificity, bidder rating, value for money,
        payment verification, realistic delivery time.
      PROMPT
    end

    def call_bedrock(prompt)
      client = Aws::BedrockRuntime::Client.new(
        region:            ENV.fetch("AWS_BEDROCK_REGION", "us-east-1"),
        access_key_id:     ENV.fetch("AWS_BEDROCK_ACCESS_KEY_ID"),
        secret_access_key: ENV.fetch("AWS_BEDROCK_SECRET_ACCESS_KEY")
      )
      response = client.converse(
        model_id: ENV.fetch("BEDROCK_MODEL_ID", DEFAULT_MODEL),
        messages: [{ role: "user", content: [{ text: prompt }] }],
        inference_config: { max_tokens: 2048, temperature: 0.3 }
      )
      response.output.message.content.first.text
    end

    def parse_response(text)
      json_text = text.gsub(/\A```(?:json)?\n?/, "").gsub(/\n?```\z/, "").strip
      JSON.parse(json_text)
    end
  end
end
