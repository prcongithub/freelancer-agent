module Bidder
  class ProposalGenerator
    def initialize
      @client = OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY", ""))
    end

    def generate(project)
      prompt   = build_prompt(project)
      response = @client.chat(
        parameters: {
          model:       "gpt-4o-mini",
          messages:    [
            { role: "system", content: system_prompt },
            { role: "user",   content: prompt }
          ],
          max_tokens:  500,
          temperature: 0.7
        }
      )

      response.dig("choices", 0, "message", "content") || fallback_proposal(project)
    rescue Faraday::ConnectionFailed, Faraday::TimeoutError, Faraday::Error => e
      Rails.logger.error("ProposalGenerator#generate network error: #{e.message}")
      fallback_proposal(project)
    rescue => e
      Rails.logger.error("ProposalGenerator#generate unexpected error: #{e.class}: #{e.message}")
      raise  # Don't swallow programming errors
    end

    private

    def system_prompt
      <<~PROMPT
        You are a freelance proposal writer for a Full Stack Developer and AWS/DevOps consultant.
        Write concise, professional proposals (150-250 words) that:
        - Reference specific project requirements
        - Highlight relevant experience
        - Propose a clear approach and timeline
        - Are confident but not arrogant
        - End with a call to action
        Do NOT use generic templates. Each proposal must be unique to the project.
      PROMPT
    end

    def build_prompt(project)
      <<~PROMPT
        Write a bid proposal for this Freelancer.com project:

        Title: #{project[:title]}
        Description: #{project[:description]}
        Skills Required: #{(project[:skills_required] || []).join(", ")}
        Budget: #{project.dig(:budget_range, :min)}-#{project.dig(:budget_range, :max)} #{project.dig(:budget_range, :currency) || "USD"}

        My relevant skills: Ruby on Rails, React, Node.js, AWS (ECS, Lambda, S3, RDS), Docker, Kubernetes, Terraform, CI/CD, PostgreSQL, MongoDB, AI/automation, TypeScript.
      PROMPT
    end

    def fallback_proposal(project)
      "Hi, I'd love to help with your #{project[:title]} project. I have extensive experience with #{(project[:skills_required] || []).first(3).join(", ")} and can deliver a high-quality solution within your timeline. Let's discuss the details."
    end
  end
end
