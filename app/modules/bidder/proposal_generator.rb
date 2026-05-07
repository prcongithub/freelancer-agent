module Bidder
  class ProposalGenerator
    include BedrockCaller

    SYSTEM_PROMPT = <<~PROMPT.freeze
      You are writing a Freelancer.com bid proposal for a Full Stack Developer and AWS/DevOps consultant
      who uses Claude Code and AI coding agents to deliver projects 3-5x faster than traditional developers.

      Write concise, confident proposals (150-250 words) that:
      - Open by directly addressing the client's specific problem (no generic greetings)
      - Reference 1-2 concrete technologies from the project requirements
      - Briefly mention AI-assisted delivery as a speed/quality advantage
      - Propose a clear approach in 2-3 sentences
      - State a realistic timeline (AI-assisted, so shorter than market average)
      - End with a specific call to action

      Do NOT use: "I am writing to", "I would like to", "I am interested in", or any generic opener.
      Do NOT mention pricing — that is set separately.
      Each proposal must be unique to the project.
    PROMPT

    def generate(project)
      cfg        = AgentConfig.for("bidder").config
      sys_prompt = cfg["proposal_system_prompt"].presence || SYSTEM_PROMPT
      max_tokens = cfg.fetch("proposal_max_tokens", 600).to_i
      temp       = cfg.fetch("proposal_temperature", 0.7).to_f

      prompt   = build_prompt(project)
      proposal = call_bedrock(prompt, system_prompt: sys_prompt, max_tokens: max_tokens, temperature: temp)

      if project[:prototype_url].present?
        proposal += "\n\nI've already built a working prototype based on your requirements — try it now:\n" \
                    "#{project[:prototype_url]}\n\n" \
                    "No setup needed. The data layer is fully wired — create, edit, and delete records live."
      end

      proposal
    rescue Aws::BedrockRuntime::Errors::ServiceError => e
      Rails.logger.error("ProposalGenerator Bedrock error: #{e.class}: #{e.message}")
      fallback_proposal(project)
    rescue => e
      Rails.logger.error("ProposalGenerator unexpected error: #{e.class}: #{e.message}")
      raise
    end

    private

    def build_prompt(project)
      ai_days        = project.dig(:analysis, "effort_days") || project.dig(:analysis, :effort_days)
      trad_days      = project.dig(:analysis, "traditional_effort_days") || project.dig(:analysis, :traditional_effort_days)
      ai_advantage   = project.dig(:analysis, "ai_advantage") || project.dig(:analysis, :ai_advantage)
      scope_summary  = project.dig(:analysis, "scope") || project.dig(:analysis, :scope)

      timeline_hint = if ai_days
        trad_days ? "#{ai_days} working days (vs ~#{trad_days}d traditional)" : "#{ai_days} working days"
      end

      <<~PROMPT
        Write a bid proposal for this Freelancer.com project:

        Title: #{project[:title]}
        Description: #{project[:description]&.slice(0, 800)}
        Skills Required: #{(project[:skills_required] || []).join(", ")}
        Budget: $#{project.dig(:budget_range, :min)}–$#{project.dig(:budget_range, :max)} #{project.dig(:budget_range, :currency) || "USD"}
        #{"Scope summary (from prior analysis): #{scope_summary}" if scope_summary}
        #{"AI delivery advantage for this project: #{ai_advantage}" if ai_advantage}
        #{"Estimated timeline: #{timeline_hint}" if timeline_hint}

        My skills: Ruby on Rails 8, React 19, TypeScript, Node.js, AWS (ECS, Lambda, S3, RDS, CloudFront),
        Docker, Kubernetes, Terraform, CI/CD, PostgreSQL, MongoDB, AI/automation (Claude, OpenAI), n8n.
      PROMPT
    end

    def fallback_proposal(project)
      skills = (project[:skills_required] || []).first(3).join(", ")
      "Your #{project[:title]} project aligns well with my stack. I've built similar systems using #{skills} " \
      "and deliver with Claude Code, which cuts typical timelines significantly. " \
      "Happy to discuss specifics — when can we connect?"
    end
  end
end
