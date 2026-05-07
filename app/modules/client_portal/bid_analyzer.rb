module ClientPortal
  class BidAnalyzer
    include BedrockCaller

    DEFAULT_RANKING = "Rank by: proposal quality and specificity, bidder rating, value for money, payment verification, realistic delivery time."

    def analyze(project:, bids:)
      return nil if bids.empty?
      cfg        = AgentConfig.for("client_portal").config
      max_tokens = cfg.fetch("max_tokens", 2048).to_i
      prompt     = build_prompt(project, bids, cfg)
      text       = call_bedrock(prompt, max_tokens: max_tokens)
      parse_response(text)
    rescue Aws::BedrockRuntime::Errors::ServiceError => e
      Rails.logger.error("ClientPortal::BidAnalyzer Bedrock error: #{e.class}: #{e.message}")
      nil
    rescue JSON::ParserError => e
      Rails.logger.error("ClientPortal::BidAnalyzer JSON parse error: #{e.message}")
      nil
    end

    private

    def build_prompt(project, bids, cfg = {})
      budget = project[:budget_range] || {}
      skills = (project[:skills_required] || []).join(", ")

      bids_text = bids.each_with_index.map do |bid, i|
        <<~BID
          Bid #{i + 1}:
            Bidder: #{bid[:bidder_name]} (ID: #{bid[:bidder_id]})
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
              "bidder_id": "<freelancer user ID string>",
              "bidder_name": "<name>",
              "bid_amount": <number>,
              "score": <integer 0-100>,
              "strengths": ["<strength>"],
              "concerns": ["<concern>"],
              "summary": "<1 sentence>"
            }
          ]
        }

        #{cfg["ranking_criteria"].presence || DEFAULT_RANKING}
      PROMPT
    end

    def parse_response(text)
      json_text = text.gsub(/\A```(?:json)?\n?/, "").gsub(/\n?```\z/, "").strip
      JSON.parse(json_text)
    end
  end
end
