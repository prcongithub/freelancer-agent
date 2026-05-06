module Analyzer
  class ProjectAnalyzer
    include BedrockCaller

    SKILL_PROFILE = <<~PROFILE.freeze
      Full Stack Developer and AWS/DevOps Consultant with 8+ years experience.

      Strong skills:
      - Backend: Ruby on Rails 8, Node.js, Express, Python (FastAPI/Flask), REST APIs, GraphQL
      - Frontend: React 19, TypeScript, Next.js, TailwindCSS, Vite
      - AWS: ECS Fargate, EC2, S3, Lambda, CloudFront, RDS, DynamoDB, VPC, Route53, IAM, Secrets Manager
      - DevOps: Docker, Kubernetes, Terraform, GitHub Actions, Jenkins, CI/CD pipelines
      - Databases: MongoDB, PostgreSQL, Redis, DynamoDB
      - AI/Automation: Claude API, OpenAI API, LangChain, RAG pipelines, n8n, Sidekiq
      - Auth: JWT, OAuth2, Devise, Passport.js

      CRITICAL — AI-Assisted Development:
      This developer is an expert at using Claude Code, Cursor, and AI coding agents for development.
      Tasks that would take a traditional developer days are completed in hours.
      Typical AI-assisted speedups by task type:
      - Boilerplate / CRUD / REST APIs: 5-8x faster (hours not days)
      - Infrastructure / IaC / CI-CD pipelines: 4-6x faster
      - Frontend UI components, dashboards: 4-5x faster
      - Integrations, third-party APIs: 3-5x faster
      - Complex business logic, algorithms: 2-3x faster
      - Architecture decisions, debugging novel issues: 1-2x faster (still needs human judgment)

      Effort estimates MUST reflect AI-assisted development, not traditional development.
      A task a junior dev takes 5 days on will take this developer 1 day with Claude Code.
      A task a senior dev takes 10 days on will take 2-3 days with AI assistance.

      Cannot do / not interested in:
      - Native mobile (iOS Swift, Android Kotlin/Java)
      - Solidity / blockchain / Web3 smart contracts
      - Hardware, embedded systems, IoT firmware
      - Graphic design, video editing, illustration
      - WordPress/Shopify theme customisation (basic sites)
      - Data science, ML model training from scratch
    PROFILE

    def analyze(project)
      prompt = build_prompt(project)
      text   = call_bedrock(prompt)
      parse_response(text)
    rescue Aws::BedrockRuntime::Errors::ServiceError => e
      Rails.logger.error("Analyzer::ProjectAnalyzer Bedrock error: #{e.class}: #{e.message}")
      nil
    rescue JSON::ParserError => e
      Rails.logger.error("Analyzer::ProjectAnalyzer JSON parse error: #{e.message}")
      nil
    rescue => e
      Rails.logger.error("Analyzer::ProjectAnalyzer error: #{e.class}: #{e.message}")
      raise
    end

    private

    def build_prompt(project)
      budget   = project.budget_range || {}
      skills   = (project.skills_required || []).join(", ")
      currency = budget["currency"] || budget[:currency] || "USD"
      max_usd  = CurrencyConverter.budget_max_usd(budget)
      budget_display = if currency == "USD"
        "$#{budget["min"] || budget[:min]}–$#{budget["max"] || budget[:max]} USD"
      else
        "#{currency} #{budget["min"] || budget[:min]}–#{budget["max"] || budget[:max]}" \
        " (≈ $#{CurrencyConverter.to_usd(budget["min"] || budget[:min] || 0, currency).round}–$#{max_usd.round} USD)"
      end

      <<~PROMPT
        You are evaluating a freelance project for a developer with the following profile:

        #{SKILL_PROFILE}

        Analyze this project and respond with ONLY a JSON object (no markdown, no explanation outside the JSON):

        PROJECT:
        Title: #{project.title}
        Description: #{project.description}
        Budget: #{budget_display}
        Skills required: #{skills}

        Respond with this exact JSON structure:
        {
          "scope": "2-3 sentence summary of what needs to be built",
          "effort_days": <integer, AI-assisted working days — apply the speedups from the profile above>,
          "traditional_effort_days": <integer, how long this would take a traditional developer without AI>,
          "calendar_weeks": <integer, calendar weeks including client back-and-forth and review cycles>,
          "recommendation": "take" | "skip" | "maybe",
          "confidence": <integer 0-100>,
          "reasoning": "1-2 sentences explaining the recommendation",
          "ai_advantage": "1 sentence on how Claude Code / AI agents specifically accelerate this project",
          "skill_gaps": ["specific skills/technologies required that fall outside the profile above"],
          "unknowns": ["things unclear in the requirements that need clarification before starting"],
          "red_flags": ["concerns: scope creep risk, low budget for scope, vague requirements, unrealistic timeline, etc"]
        }

        effort_days must reflect AI-assisted speed. Be honest: flag it if the budget is too low even at AI-assisted rates.
      PROMPT
    end

    def parse_response(text)
      JSON.parse(text)
    end
  end
end
