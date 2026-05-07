class AgentConfig
  include Mongoid::Document
  include Mongoid::Timestamps

  AGENTS = %w[scanner analyzer bidder prototyper tracker client_portal].freeze

  field :agent,  type: String
  field :config, type: Hash, default: {}

  validates :agent, presence: true, uniqueness: true, inclusion: { in: AGENTS }

  index({ agent: 1 }, { unique: true })

  def self.for(agent_name)
    find_or_create_by!(agent: agent_name.to_s) do |doc|
      doc.config = DEFAULTS.fetch(agent_name.to_s, {})
    end
  end

  def self.seed_defaults!
    DEFAULTS.each do |agent_name, default_config|
      next if where(agent: agent_name).exists?
      create!(agent: agent_name, config: default_config)
      Rails.logger.info("AgentConfig: seeded #{agent_name}")
    end
  end

  DEFAULTS = {
    "scanner" => {
      "threshold"           => 65,
      "skill_match_minimum" => 25,
      "keyword_groups"      => {
        "aws_devops"    => %w[aws docker kubernetes terraform devops],
        "backend"       => ["ruby on rails", "node.js", "express", "python api"],
        "frontend"      => %w[react angular typescript dashboard],
        "ai_automation" => ["ai agent", "chatbot", "openai", "claude", "rag"],
        "fullstack"     => ["full stack", "web application", "saas"]
      }
    },
    "analyzer" => {
      "skill_profile" => <<~PROFILE.strip,
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
      "model_id"    => "global.anthropic.claude-haiku-4-5-20251001-v1:0",
      "max_tokens"  => 1024,
      "temperature" => 0.3
    },
    "bidder" => {
      "category_rates" => {
        "aws_devops"    => { "min" => 75,  "max" => 100 },
        "ai_automation" => { "min" => 100, "max" => 120 },
        "fullstack"     => { "min" => 60,  "max" => 80  },
        "backend"       => { "min" => 60,  "max" => 80  },
        "frontend"      => { "min" => 40,  "max" => 60  }
      },
      "agent_discount_threshold" => 70,
      "proposal_system_prompt"   => <<~PROMPT.strip,
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
      "proposal_max_tokens"  => 600,
      "proposal_temperature" => 0.7
    },
    "prototyper" => {
      "system_prompt" => "You are building a working prototype for a Freelancer.com client.\nReturn ONLY a complete, self-contained HTML file. No explanation, no markdown, no code fences.",
      "category_hints" => {
        "frontend"      => "Build a full UI with working navigation, multiple pages/views, and all data operations wired to the API.",
        "fullstack"     => "Build a full UI with working navigation, multiple pages/views, and all data operations wired to the API.",
        "ai_automation" => "Build a chat interface or workflow UI. Simulate streaming AI responses by fetching from /:proto_id/messages and animating the text display.",
        "backend"       => "Build a clean API Explorer UI (Swagger-style) listing all available endpoints with example request/response panels. Include a live 'Try it' button.",
        "aws_devops"    => "Build an infrastructure dashboard UI showing mock AWS resource statuses, cost metrics, and deployment pipeline stages."
      },
      "max_tokens"  => 8000,
      "temperature" => 0.5
    },
    "tracker" => {
      "auto_bid_threshold" => 80
    },
    "client_portal" => {
      "ranking_criteria" => "Rank by: proposal quality and specificity, bidder rating, value for money, payment verification, realistic delivery time.",
      "max_tokens"       => 2048
    }
  }.freeze
end
