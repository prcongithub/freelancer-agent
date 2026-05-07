# Admin Agent Configuration UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Build an admin-only UI at `/admin/agents/:agent` where a `super_admin` can view and edit prompts, rates, thresholds, and settings for all 6 agent modules. Changes take effect on the next job run with no restart.

**Architecture:** New `AgentConfig` Mongoid model (one document per agent) stores all configurable values. Agent modules fall back to hardcoded constants if DB record is missing. A new `Api::V1::Admin::AgentsController` serves `GET/PATCH /api/v1/admin/agents/:agent`. Frontend adds a per-agent config page with markdown editor (`@uiw/react-md-editor`), number inputs, and JSON textareas.

**Tech Stack:** Rails 8 API, Mongoid 9, React 19 + TypeScript, `@uiw/react-md-editor`, React Router v7, TailwindCSS v4.

---

## Context: Codebase Layout

```
freelancing-agent/
  app/
    models/
      setting.rb                     ← reference for singleton pattern
      agent_config.rb                ← Task 1 creates
    controllers/api/v1/admin/
      users_controller.rb            ← reference for admin controller pattern
      agents_controller.rb           ← Task 2 creates
    modules/
      bedrock_caller.rb              ← shared module; DEFAULT_MODEL fallback
      scanner/scan_job.rb            ← Task 3 modifies
      analyzer/project_analyzer.rb   ← Task 4 modifies
      bidder/pricing_engine.rb       ← Task 5 modifies
      bidder/proposal_generator.rb   ← Task 5 modifies
      prototyper/prototype_generator.rb ← Task 6 modifies
      tracker/auto_bid_job.rb        ← Task 7 modifies
      client_portal/bid_analyzer.rb  ← Task 7 modifies
  config/
    routes.rb                        ← Task 2 modifies
  db/seeds.rb                        ← Task 1 modifies
  frontend/src/
    types/api.ts                     ← Task 8 modifies
    api/client.ts                    ← Task 8 modifies
    pages/admin/
      AdminAgentConfig.tsx           ← Task 9 creates
    App.tsx                          ← Task 10 modifies
```

**Key patterns:**
- Admin controllers: `before_action { require_role!(:super_admin) }`, no rescue blocks (ApplicationController handles DocumentNotFound)
- Mongoid singleton: `find_or_create_by!(field: value)` — see `Setting.instance`
- Agent modules include `BedrockCaller` for Bedrock calls; `ENV.fetch("BEDROCK_MODEL_ID", DEFAULT_MODEL)` is the current model fallback

---

## Task 1: AgentConfig model + seed defaults

**Files:**
- Create: `app/models/agent_config.rb`
- Create: `spec/models/agent_config_spec.rb`
- Modify: `db/seeds.rb`

**Step 1: Create the model**

```ruby
# app/models/agent_config.rb
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
```

**Step 2: Write model spec**

```ruby
# spec/models/agent_config_spec.rb
require 'rails_helper'

RSpec.describe AgentConfig, type: :model do
  describe 'validations' do
    it 'is valid with a known agent name' do
      expect(build(:agent_config, agent: 'scanner')).to be_valid
    end

    it 'is invalid with an unknown agent' do
      cfg = build(:agent_config, agent: 'unknown')
      expect(cfg).not_to be_valid
      expect(cfg.errors[:agent]).to be_present
    end

    it 'requires uniqueness on agent' do
      create(:agent_config, agent: 'analyzer')
      dup = build(:agent_config, agent: 'analyzer')
      expect(dup).not_to be_valid
    end
  end

  describe '.for' do
    it 'creates a record with defaults when missing' do
      cfg = AgentConfig.for('scanner')
      expect(cfg).to be_persisted
      expect(cfg.config['threshold']).to eq(65)
    end

    it 'returns existing record without overwriting' do
      create(:agent_config, agent: 'scanner', config: { 'threshold' => 99 })
      cfg = AgentConfig.for('scanner')
      expect(cfg.config['threshold']).to eq(99)
    end
  end

  describe '.seed_defaults!' do
    it 'creates documents for all 6 agents' do
      AgentConfig.seed_defaults!
      expect(AgentConfig.count).to eq(6)
    end

    it 'does not overwrite existing records' do
      create(:agent_config, agent: 'tracker', config: { 'auto_bid_threshold' => 42 })
      AgentConfig.seed_defaults!
      expect(AgentConfig.for('tracker').config['auto_bid_threshold']).to eq(42)
    end
  end
end
```

**Step 3: Create factory**

Add to `spec/factories/agent_configs.rb`:

```ruby
FactoryBot.define do
  factory :agent_config do
    agent  { 'scanner' }
    config { {} }
  end
end
```

**Step 4: Run spec**

```bash
cd /path/to/freelancing-agent
docker compose exec api bundle exec rspec spec/models/agent_config_spec.rb -f doc
```

Expected: 5 examples, 0 failures

**Step 5: Add to seeds**

In `db/seeds.rb`, append:

```ruby
AgentConfig.seed_defaults!
puts "AgentConfig: seeded #{AgentConfig.count} agents"
```

**Step 6: Run seeds**

```bash
docker compose exec api bundle exec rails db:seed
```

Expected: prints "AgentConfig: seeded 6 agents"

**Step 7: Commit**

```bash
git add app/models/agent_config.rb spec/models/agent_config_spec.rb spec/factories/agent_configs.rb db/seeds.rb
git commit -m "feat: add AgentConfig model with seed defaults for all 6 agents"
```

---

## Task 2: Admin::AgentsController + routes

**Files:**
- Create: `app/controllers/api/v1/admin/agents_controller.rb`
- Create: `spec/requests/api/v1/admin/agents_spec.rb`
- Modify: `config/routes.rb`

**Step 1: Create controller**

```ruby
# app/controllers/api/v1/admin/agents_controller.rb
module Api
  module V1
    module Admin
      class AgentsController < ApplicationController
        before_action { require_role!(:super_admin) }

        ALLOWED_AGENTS = AgentConfig::AGENTS.freeze

        def index
          configs = ALLOWED_AGENTS.map do |agent|
            serialize(AgentConfig.for(agent))
          end
          render json: { agents: configs }
        end

        def show
          return render json: { error: "Unknown agent" }, status: :not_found unless ALLOWED_AGENTS.include?(params[:agent])
          render json: { agent: serialize(AgentConfig.for(params[:agent])) }
        end

        def update
          return render json: { error: "Unknown agent" }, status: :not_found unless ALLOWED_AGENTS.include?(params[:agent])
          cfg = AgentConfig.for(params[:agent])
          cfg.update!(config: params.require(:config).to_unsafe_h)
          render json: { agent: serialize(cfg) }
        end

        private

        def serialize(cfg)
          { agent: cfg.agent, config: cfg.config, updated_at: cfg.updated_at }
        end
      end
    end
  end
end
```

**Step 2: Add routes**

In `config/routes.rb`, inside `namespace :admin do`:

```ruby
namespace :admin do
  resources :users, only: [:index, :update]
  get :stats, to: "stats#index"
  resources :agents, only: [:index, :show, :update], param: :agent
end
```

**Step 3: Write request spec**

```ruby
# spec/requests/api/v1/admin/agents_spec.rb
require 'rails_helper'

RSpec.describe "Api::V1::Admin::Agents", type: :request do
  let(:admin_token) { Auth::TokenService.encode(user_id: "admin-id", role: "super_admin") }
  let(:headers)     { { "Authorization" => "Bearer #{admin_token}" } }

  before { AgentConfig.seed_defaults! }

  describe "GET /api/v1/admin/agents" do
    it "returns all 6 agents" do
      get "/api/v1/admin/agents", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json["agents"].length).to eq(6)
    end

    it "returns 403 for non-admin" do
      token = Auth::TokenService.encode(user_id: "u", role: "freelancer")
      get "/api/v1/admin/agents", headers: { "Authorization" => "Bearer #{token}" }
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/admin/agents/:agent" do
    it "returns the agent config" do
      get "/api/v1/admin/agents/scanner", headers: headers
      expect(response).to have_http_status(:ok)
      expect(json["agent"]["agent"]).to eq("scanner")
      expect(json["agent"]["config"]["threshold"]).to eq(65)
    end

    it "returns 404 for unknown agent" do
      get "/api/v1/admin/agents/unknown", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/admin/agents/:agent" do
    it "updates the agent config" do
      patch "/api/v1/admin/agents/scanner",
            params: { config: { threshold: 75, skill_match_minimum: 30, keyword_groups: {} } }.to_json,
            headers: headers.merge("Content-Type" => "application/json")
      expect(response).to have_http_status(:ok)
      expect(json["agent"]["config"]["threshold"]).to eq(75)
      expect(AgentConfig.for("scanner").config["threshold"]).to eq(75)
    end
  end

  def json
    JSON.parse(response.body)
  end
end
```

**Step 4: Run spec**

```bash
docker compose exec api bundle exec rspec spec/requests/api/v1/admin/agents_spec.rb -f doc
```

Expected: 5 examples, 0 failures

**Step 5: Commit**

```bash
git add app/controllers/api/v1/admin/agents_controller.rb spec/requests/api/v1/admin/agents_spec.rb config/routes.rb
git commit -m "feat: add Admin::AgentsController with index/show/update endpoints"
```

---

## Task 3: Update Scanner to read from AgentConfig

**Files:**
- Modify: `app/modules/scanner/scan_job.rb`

**Step 1: Update ScanJob**

Replace hardcoded `KEYWORD_GROUPS` and threshold values with AgentConfig lookups. The `KEYWORD_GROUPS` constant is kept as a fallback.

```ruby
# app/modules/scanner/scan_job.rb
module Scanner
  class ScanJob
    include Sidekiq::Job
    sidekiq_options queue: :scanning

    KEYWORD_GROUPS = {
      aws_devops: %w[aws docker kubernetes terraform devops],
      backend: ["ruby on rails", "node.js", "express", "python api"],
      frontend: %w[react angular typescript dashboard],
      ai_automation: ["ai agent", "chatbot", "openai", "claude", "rag"],
      fullstack: ["full stack", "web application", "saas"]
    }.freeze

    def perform(user_id = nil)
      cfg    = AgentConfig.for("scanner").config
      groups = (cfg["keyword_groups"] || {}).presence&.transform_keys(&:to_sym) || KEYWORD_GROUPS
      threshold          = cfg.fetch("threshold", 65).to_i
      skill_min          = cfg.fetch("skill_match_minimum", 25).to_i

      client = FreelancerClient.new
      scorer = ProjectScorer.new

      groups.each do |_category, keywords|
        projects = client.search_projects(keywords: Array(keywords))

        projects.each do |project_data|
          score    = scorer.score(project_data)
          category = scorer.categorize(project_data)

          next if score[:total] < threshold
          next if category.nil?
          next if score[:skill_match] < skill_min
          next if (project_data.dig(:budget_range, :currency) || "USD") != "USD"

          begin
            project = Project.create!(
              user_id:         user_id,
              freelancer_id:   project_data[:freelancer_id],
              title:           project_data[:title],
              description:     project_data[:description],
              budget_range:    project_data[:budget_range],
              skills_required: project_data[:skills_required],
              client:          project_data[:client],
              freelancer_url:  project_data[:freelancer_url],
              bid_stats:       project_data[:bid_stats] || {},
              upgrades:        project_data[:upgrades] || {},
              fit_score:       score,
              category:        category,
              status:          "discovered",
              discovered_at:   Time.current
            )
            Analyzer::AnalyzeJob.perform_async(project.id.to_s)
          rescue Mongoid::Errors::Validations => e
            next if e.document.errors[:freelancer_id].any?
            raise
          rescue Mongo::Error::OperationFailure => e
            next if e.message.include?("11000")
            raise
          end
        end
      end
    end
  end
end
```

**Step 2: Verify no existing scanner specs break**

```bash
docker compose exec api bundle exec rspec spec/ -f doc 2>&1 | grep -E "(scanner|FAILED|ERROR)" | head -20
```

Expected: scanner-related examples pass.

**Step 3: Commit**

```bash
git add app/modules/scanner/scan_job.rb
git commit -m "feat: Scanner reads threshold, skill_match_minimum, keyword_groups from AgentConfig"
```

---

## Task 4: Update Analyzer to read from AgentConfig

**Files:**
- Modify: `app/modules/analyzer/project_analyzer.rb`

**Step 1: Update ProjectAnalyzer**

`SKILL_PROFILE` constant is kept as a fallback. The `call_bedrock` call passes `max_tokens` and `temperature` from config.

```ruby
# app/modules/analyzer/project_analyzer.rb
module Analyzer
  class ProjectAnalyzer
    include BedrockCaller

    SKILL_PROFILE = <<~PROFILE.freeze
      Full Stack Developer and AWS/DevOps Consultant with 8+ years experience.
      # (keep the full existing constant text unchanged as fallback)
    PROFILE

    def analyze(project)
      prompt = build_prompt(project)
      cfg    = AgentConfig.for("analyzer").config
      text   = call_bedrock(
        prompt,
        max_tokens:  cfg.fetch("max_tokens",  1024).to_i,
        temperature: cfg.fetch("temperature", 0.3).to_f
      )
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

    def skill_profile
      AgentConfig.for("analyzer").config.fetch("skill_profile", SKILL_PROFILE)
    end

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

        #{skill_profile}

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
```

**Important:** Keep `SKILL_PROFILE` constant body exactly as it exists in the current file — copy it verbatim; only the `analyze` and `skill_profile` method bodies change.

**Step 2: Run existing analyzer specs**

```bash
docker compose exec api bundle exec rspec spec/ -f doc 2>&1 | grep -E "(nalyz|FAILED|ERROR)" | head -20
```

Expected: passing.

**Step 3: Commit**

```bash
git add app/modules/analyzer/project_analyzer.rb
git commit -m "feat: Analyzer reads skill_profile, max_tokens, temperature from AgentConfig"
```

---

## Task 5: Update Bidder (PricingEngine + ProposalGenerator)

**Files:**
- Modify: `app/modules/bidder/pricing_engine.rb`
- Modify: `app/modules/bidder/proposal_generator.rb`

**Step 1: Update PricingEngine**

`CATEGORY_RATES` and `AGENT_DISCOUNT_THRESHOLD` constants kept as fallbacks.

```ruby
# app/modules/bidder/pricing_engine.rb
module Bidder
  class PricingEngine
    CATEGORY_RATES = {
      "aws_devops"    => { min: 75,  max: 100 },
      "ai_automation" => { min: 100, max: 120 },
      "fullstack"     => { min: 60,  max: 80  },
      "backend"       => { min: 60,  max: 80  },
      "frontend"      => { min: 40,  max: 60  }
    }.freeze

    AGENT_DISCOUNT_THRESHOLD = 70
    AGENT_DISCOUNT_PERCENT   = 0.25

    def calculate(project)
      cfg      = AgentConfig.for("bidder").config
      db_rates = (cfg["category_rates"] || {}).transform_values { |v|
        { min: v["min"].to_i, max: v["max"].to_i }
      }
      rates_map          = db_rates.presence || CATEGORY_RATES
      discount_threshold = cfg.fetch("agent_discount_threshold", AGENT_DISCOUNT_THRESHOLD).to_f

      category    = project[:category] || "fullstack"
      rates       = rates_map[category] || rates_map["fullstack"] || CATEGORY_RATES["fullstack"]
      hourly_rate = ((rates[:min] + rates[:max]) / 2.0).round

      effort_days     = project.dig(:analysis, "effort_days") || project.dig(:analysis, :effort_days)
      estimated_hours = effort_days ? (effort_days * 6).round : estimate_hours_from_budget(project)

      traditional_days = project.dig(:analysis, "traditional_effort_days") ||
                         project.dig(:analysis, :traditional_effort_days)

      base_amount = hourly_rate * estimated_hours

      agent_score = (project.dig(:fit_score, :agent_buildable) ||
                     project.dig(:fit_score, "agent_buildable") || 0).to_f
      discount    = agent_score >= discount_threshold ? AGENT_DISCOUNT_PERCENT : 0.0

      full_amount_usd = (base_amount * (1 - discount)).round

      budget_range   = project[:budget_range] || project["budget_range"] || {}
      max_budget_usd = CurrencyConverter.budget_max_usd(budget_range)
      currency       = CurrencyConverter.currency_for(budget_range)

      within_budget = max_budget_usd <= 0 || full_amount_usd <= max_budget_usd
      capped_usd    = within_budget ? full_amount_usd : max_budget_usd.round
      amount_native = CurrencyConverter.from_usd(capped_usd, currency).round

      {
        amount:           amount_native,
        amount_usd:       capped_usd,
        full_amount_usd:  full_amount_usd,
        currency:         currency,
        within_budget:    within_budget,
        hourly_rate:      hourly_rate,
        estimated_hours:  estimated_hours,
        traditional_days: traditional_days,
        ai_speedup:       traditional_days && effort_days ? (traditional_days.to_f / effort_days).round(1) : nil,
        discount_applied: discount,
        rate_range:       rates
      }
    end

    private

    def estimate_hours_from_budget(project)
      budget_usd = CurrencyConverter.budget_max_usd(project[:budget_range] || project["budget_range"] || {})
      if    budget_usd <= 200  then 2
      elsif budget_usd <= 500  then 4
      elsif budget_usd <= 2000 then 8
      elsif budget_usd <= 5000 then 16
      else                          32
      end
    end
  end
end
```

**Step 2: Update ProposalGenerator**

`SYSTEM_PROMPT` constant kept as fallback.

```ruby
# app/modules/bidder/proposal_generator.rb
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
      ai_days       = project.dig(:analysis, "effort_days") || project.dig(:analysis, :effort_days)
      trad_days     = project.dig(:analysis, "traditional_effort_days") || project.dig(:analysis, :traditional_effort_days)
      ai_advantage  = project.dig(:analysis, "ai_advantage") || project.dig(:analysis, :ai_advantage)
      scope_summary = project.dig(:analysis, "scope") || project.dig(:analysis, :scope)

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
```

**Step 3: Run all specs**

```bash
docker compose exec api bundle exec rspec spec/ --format progress
```

Expected: 0 failures.

**Step 4: Commit**

```bash
git add app/modules/bidder/pricing_engine.rb app/modules/bidder/proposal_generator.rb
git commit -m "feat: Bidder reads category_rates, discount_threshold, proposal_system_prompt from AgentConfig"
```

---

## Task 6: Update Prototyper to read from AgentConfig

**Files:**
- Modify: `app/modules/prototyper/prototype_generator.rb`

**Step 1: Update PrototypeGenerator**

`CATEGORY_HINTS` constant kept as fallback.

In the `generate` method, read `max_tokens` and `temperature` from AgentConfig. In `build_prompt`, read `category_hints` from AgentConfig.

```ruby
# app/modules/prototyper/prototype_generator.rb
module Prototyper
  class PrototypeGenerator
    include BedrockCaller

    CATEGORY_HINTS = {
      "frontend"      => "Build a full UI with working navigation, multiple pages/views, and all data operations wired to the API.",
      "fullstack"     => "Build a full UI with working navigation, multiple pages/views, and all data operations wired to the API.",
      "ai_automation" => "Build a chat interface or workflow UI. Simulate streaming AI responses by fetching from /:proto_id/messages and animating the text display.",
      "backend"       => "Build a clean API Explorer UI (Swagger-style) listing all available endpoints with example request/response panels. Include a live 'Try it' button.",
      "aws_devops"    => "Build an infrastructure dashboard UI showing mock AWS resource statuses, cost metrics, and deployment pipeline stages."
    }.freeze

    def generate(project_data)
      cfg        = AgentConfig.for("prototyper").config
      max_tokens = cfg.fetch("max_tokens", 8000).to_i
      temp       = cfg.fetch("temperature", 0.5).to_f

      prompt = build_prompt(project_data)
      html   = call_bedrock(prompt, max_tokens: max_tokens, temperature: temp)

      unless valid_html?(html)
        html = call_bedrock(build_simple_prompt(project_data), max_tokens: max_tokens, temperature: temp)
        raise "Malformed HTML after retry" unless valid_html?(html)
      end

      html
    end

    def upload_to_s3(html, proto_id)
      bucket = ENV.fetch("S3_PROTOTYPE_BUCKET", "freelancing-prototypes")
      key    = "prototypes/#{proto_id}/index.html"
      region = ENV.fetch("AWS_BEDROCK_REGION", "us-east-1")

      client = Aws::S3::Client.new(
        region:            region,
        access_key_id:     ENV.fetch("AWS_BEDROCK_ACCESS_KEY_ID"),
        secret_access_key: ENV.fetch("AWS_BEDROCK_SECRET_ACCESS_KEY")
      )

      client.put_object(
        bucket:       bucket,
        key:          key,
        body:         html,
        content_type: "text/html",
        acl:          "public-read"
      )

      cf_base = ENV.fetch("CLOUDFRONT_PROTOTYPE_URL", "")
      if cf_base.present?
        "#{cf_base}/prototypes/#{proto_id}/index.html"
      else
        "https://#{bucket}.s3.#{region}.amazonaws.com/#{key}"
      end
    end

    private

    def category_hints
      cfg = AgentConfig.for("prototyper").config
      (cfg["category_hints"] || {}).presence || CATEGORY_HINTS
    end

    def build_prompt(project_data)
      proto_id      = project_data[:proto_id]
      proto_url     = project_data[:proto_api_url]
      category      = project_data[:category] || "fullstack"
      scope         = project_data.dig(:analysis, "scope") || project_data.dig(:analysis, :scope) || ""
      skills        = (project_data[:skills_required] || []).join(", ")
      category_hint = category_hints[category] || category_hints["fullstack"] || CATEGORY_HINTS["fullstack"]

      <<~PROMPT
        You are building a working prototype for a Freelancer.com client.
        Return ONLY a complete, self-contained HTML file. No explanation, no markdown, no code fences.

        PROJECT:
        Title: #{project_data[:title]}
        Description: #{project_data[:description]&.slice(0, 600)}
        Scope: #{scope}
        Skills: #{skills}

        PROTOTYPE API:
        Base URL: #{proto_url}/#{proto_id}
        Available endpoints (call with fetch()):
          GET/POST  /#{proto_id}/:collection          (list/create documents)
          GET/PUT/DELETE /#{proto_id}/:collection/:id (get/update/delete one)
          POST /#{proto_id}/auth/register             ({ email, password } → { token })
          POST /#{proto_id}/auth/login                ({ email, password } → { token })
          GET  /#{proto_id}/auth/me                   (Bearer token → user)
          POST /#{proto_id}/uploads                   (multipart → { url })

        REQUIREMENTS:
        - Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
        - Alpine.js CDN: <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
        - On first load, seed 3-5 realistic sample documents via POST (use localStorage flag "seeded_#{proto_id}" to avoid re-seeding)
        - Professional design, mobile-responsive, looks like a real production app
        - Subtle watermark bottom-right: "⚡ Prototype by Prashant C."
        - Handle API errors gracefully
        - #{category_hint}

        Return the complete HTML file starting with <!DOCTYPE html>.
      PROMPT
    end

    def build_simple_prompt(project_data)
      proto_id  = project_data[:proto_id]
      proto_url = project_data[:proto_api_url]

      <<~PROMPT
        Build a simple single-page CRUD app as a self-contained HTML file.
        Use Tailwind CDN and Alpine.js CDN.
        API base: #{proto_url}/#{proto_id}
        App name: #{project_data[:title]}
        Show a list from GET /#{proto_id}/items, add form, delete buttons.
        Watermark "⚡ Prototype by Prashant C." bottom-right.
        Return ONLY the HTML file starting with <!DOCTYPE html>.
      PROMPT
    end

    def valid_html?(html)
      html.to_s.include?("</html>")
    end
  end
end
```

**Step 2: Run specs**

```bash
docker compose exec api bundle exec rspec spec/ --format progress
```

**Step 3: Commit**

```bash
git add app/modules/prototyper/prototype_generator.rb
git commit -m "feat: Prototyper reads category_hints, max_tokens, temperature from AgentConfig"
```

---

## Task 7: Update Tracker + ClientPortal

**Files:**
- Modify: `app/modules/tracker/auto_bid_job.rb`
- Modify: `app/modules/client_portal/bid_analyzer.rb`

**Step 1: Update AutoBidJob**

Replace `Setting.instance.auto_bid_threshold` with `AgentConfig.for("tracker")`:

```ruby
# app/modules/tracker/auto_bid_job.rb
module Tracker
  class AutoBidJob
    include Sidekiq::Job
    sidekiq_options queue: :bidding

    def perform
      cfg       = AgentConfig.for("tracker").config
      threshold = cfg.fetch("auto_bid_threshold", 80).to_i

      Project.where(status: "discovered")
             .above_threshold(threshold)
             .each do |project|
        Bidder::SubmitBidJob.perform_async(project.id.to_s)
      end
    end
  end
end
```

**Step 2: Update BidAnalyzer**

Extract `ranking_criteria` from AgentConfig and inject at the bottom of the prompt. The fallback is the current hardcoded line.

```ruby
# app/modules/client_portal/bid_analyzer.rb
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

    def build_prompt(project, bids, cfg)
      budget   = project[:budget_range] || {}
      skills   = (project[:skills_required] || []).join(", ")
      ranking  = cfg["ranking_criteria"].presence || DEFAULT_RANKING

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

        #{ranking}
      PROMPT
    end

    def parse_response(text)
      json_text = text.gsub(/\A```(?:json)?\n?/, "").gsub(/\n?```\z/, "").strip
      JSON.parse(json_text)
    end
  end
end
```

**Step 3: Run all specs**

```bash
docker compose exec api bundle exec rspec spec/ --format progress
```

Expected: 0 failures.

**Step 4: Commit**

```bash
git add app/modules/tracker/auto_bid_job.rb app/modules/client_portal/bid_analyzer.rb
git commit -m "feat: Tracker and ClientPortal read settings from AgentConfig"
```

---

## Task 8: Frontend — TypeScript types + API client

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/api/client.ts`

**Step 1: Add AgentConfig type to api.ts**

Add after the `UserProfile` interface at the end of `frontend/src/types/api.ts`:

```typescript
export interface AgentConfig {
  agent: string;
  config: Record<string, unknown>;
  updated_at?: string;
}
```

**Step 2: Add AgentConfig to the import in client.ts**

Change line 2 of `frontend/src/api/client.ts`:

```typescript
import type { Project, Bid, DashboardData, Settings, ClientProject, ClientAnalysisResult, AdminUser, AdminStats, Prototype, UserProfile, AgentConfig } from '../types/api';
```

**Step 3: Add API calls at the end of client.ts (before `export default api`)**

```typescript
// Agent Config Admin API
export const fetchAgentConfigs = () =>
  api.get<{ agents: AgentConfig[] }>('/admin/agents');

export const fetchAgentConfig = (agent: string) =>
  api.get<{ agent: AgentConfig }>(`/admin/agents/${agent}`);

export const updateAgentConfig = (agent: string, config: Record<string, unknown>) =>
  api.patch<{ agent: AgentConfig }>(`/admin/agents/${agent}`, { config });
```

**Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/api/client.ts
git commit -m "feat: add AgentConfig TypeScript type and admin agent API calls"
```

---

## Task 9: Frontend — AdminAgentConfig page

**Files:**
- Create: `frontend/src/pages/admin/AdminAgentConfig.tsx`

**Step 1: Install @uiw/react-md-editor**

```bash
cd frontend && npm install @uiw/react-md-editor
```

**Step 2: Create the page**

Create `frontend/src/pages/admin/AdminAgentConfig.tsx`:

```tsx
import { useEffect, useState, useCallback } from 'react';
import { useParams, NavLink, useNavigate } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';
import { fetchAgentConfig, updateAgentConfig } from '../../api/client';

const AGENTS = [
  { key: 'scanner',       label: 'Scanner' },
  { key: 'analyzer',      label: 'Analyzer' },
  { key: 'bidder',        label: 'Bidder' },
  { key: 'prototyper',    label: 'Prototyper' },
  { key: 'tracker',       label: 'Tracker' },
  { key: 'client_portal', label: 'Client Portal' },
];

type FieldDef =
  | { key: string; label: string; type: 'markdown'; hint?: string }
  | { key: string; label: string; type: 'json';     hint?: string }
  | { key: string; label: string; type: 'number';   hint?: string; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: 'text';     hint?: string };

const AGENT_FIELDS: Record<string, FieldDef[]> = {
  scanner: [
    { key: 'threshold',           label: 'Score Threshold',       type: 'number', min: 0, max: 100, hint: 'Min fit score to store a project (default: 65)' },
    { key: 'skill_match_minimum', label: 'Skill Match Minimum',   type: 'number', min: 0, max: 100, hint: 'Min skill overlap score (default: 25)' },
    { key: 'keyword_groups',      label: 'Keyword Groups',        type: 'json',   hint: 'JSON object: category → array of keyword strings' },
  ],
  analyzer: [
    { key: 'skill_profile', label: 'Skill Profile',  type: 'markdown', hint: 'Developer profile sent to Claude for project analysis' },
    { key: 'model_id',      label: 'Model ID',       type: 'text',     hint: 'Bedrock model ID (e.g. global.anthropic.claude-haiku-4-5-...)' },
    { key: 'max_tokens',    label: 'Max Tokens',     type: 'number',   min: 100, max: 16000 },
    { key: 'temperature',   label: 'Temperature',    type: 'number',   min: 0, max: 1, step: 0.05 },
  ],
  bidder: [
    { key: 'category_rates',           label: 'Category Rates',           type: 'json',     hint: 'JSON: { "aws_devops": { "min": 75, "max": 100 }, ... }' },
    { key: 'agent_discount_threshold', label: 'Agent Discount Threshold', type: 'number',   min: 0, max: 100, hint: 'Agent-buildable score ≥ this gets 25% discount (default: 70)' },
    { key: 'proposal_system_prompt',   label: 'Proposal System Prompt',   type: 'markdown', hint: 'System prompt for bid proposal generation' },
    { key: 'proposal_max_tokens',      label: 'Proposal Max Tokens',      type: 'number',   min: 100, max: 4000 },
    { key: 'proposal_temperature',     label: 'Proposal Temperature',     type: 'number',   min: 0, max: 1, step: 0.05 },
  ],
  prototyper: [
    { key: 'category_hints', label: 'Category Hints', type: 'json',   hint: 'JSON: { "frontend": "...", "fullstack": "...", ... }' },
    { key: 'max_tokens',     label: 'Max Tokens',     type: 'number', min: 1000, max: 16000 },
    { key: 'temperature',    label: 'Temperature',    type: 'number', min: 0, max: 1, step: 0.05 },
  ],
  tracker: [
    { key: 'auto_bid_threshold', label: 'Auto-Bid Threshold', type: 'number', min: 0, max: 100, hint: 'Projects scoring above this are auto-bid without manual approval (default: 80)' },
  ],
  client_portal: [
    { key: 'ranking_criteria', label: 'Ranking Criteria', type: 'markdown', hint: 'Instructions for how to rank bids' },
    { key: 'max_tokens',       label: 'Max Tokens',       type: 'number',   min: 100, max: 8000 },
  ],
};

export default function AdminAgentConfig() {
  const { agent = 'scanner' } = useParams<{ agent: string }>();
  const navigate = useNavigate();

  const [config, setConfig]       = useState<Record<string, unknown>>({});
  const [draft, setDraft]         = useState<Record<string, unknown>>({});
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  const fields = AGENT_FIELDS[agent] ?? [];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAgentConfig(agent);
      setConfig(res.data.agent.config);
      setDraft(res.data.agent.config);
    } catch {
      setError('Failed to load agent config.');
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => { load(); }, [load]);

  // Warn on unsaved changes
  useEffect(() => {
    const isDirty = JSON.stringify(draft) !== JSON.stringify(config);
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [draft, config]);

  const setField = (key: string, value: unknown) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const validateJson = (key: string, raw: string): boolean => {
    try {
      JSON.parse(raw);
      setJsonErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
      return true;
    } catch {
      setJsonErrors(prev => ({ ...prev, [key]: 'Invalid JSON' }));
      return false;
    }
  };

  const handleSave = async () => {
    // Validate all JSON fields first
    for (const field of fields) {
      if (field.type === 'json') {
        const raw = typeof draft[field.key] === 'string'
          ? draft[field.key] as string
          : JSON.stringify(draft[field.key] ?? {}, null, 2);
        if (!validateJson(field.key, raw)) return;
      }
    }

    // Convert JSON strings back to objects before saving
    const finalConfig: Record<string, unknown> = { ...draft };
    for (const field of fields) {
      if (field.type === 'json' && typeof finalConfig[field.key] === 'string') {
        finalConfig[field.key] = JSON.parse(finalConfig[field.key] as string);
      }
    }

    setSaving(true);
    setError(null);
    try {
      const res = await updateAgentConfig(agent, finalConfig);
      setConfig(res.data.agent.config);
      setDraft(res.data.agent.config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

  return (
    <div className="flex gap-6">
      {/* Sidebar */}
      <aside className="w-44 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 px-2">Agents</p>
        <nav className="flex flex-col gap-0.5">
          {AGENTS.map(a => (
            <NavLink
              key={a.key}
              to={`/admin/agents/${a.key}`}
              className={({ isActive }) =>
                isActive
                  ? 'px-3 py-2 rounded-lg text-sm font-semibold text-indigo-600 bg-indigo-50'
                  : 'px-3 py-2 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors'
              }
            >
              {a.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight capitalize">
            {agent.replace('_', ' ')} Agent
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Changes take effect on the next job run.
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-3 py-8 text-slate-400">
            <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : (
          <div className="space-y-6">
            {fields.map(field => (
              <FieldRow
                key={field.key}
                field={field}
                value={draft[field.key]}
                jsonError={jsonErrors[field.key]}
                onChange={(val) => setField(field.key, val)}
                onJsonChange={(raw) => {
                  setField(field.key, raw);
                  validateJson(field.key, raw);
                }}
              />
            ))}

            <div className="flex items-center gap-3 pt-2 border-t border-slate-200">
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {saved && (
                <span className="text-sm text-green-600 font-medium">✓ Saved</span>
              )}
              {isDirty && !saving && (
                <span className="text-xs text-slate-400">Unsaved changes</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({
  field, value, jsonError, onChange, onJsonChange
}: {
  field: FieldDef;
  value: unknown;
  jsonError?: string;
  onChange: (val: unknown) => void;
  onJsonChange: (raw: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1">
        {field.label}
      </label>
      {field.hint && (
        <p className="text-xs text-slate-400 mb-2">{field.hint}</p>
      )}

      {field.type === 'markdown' && (
        <div data-color-mode="light">
          <MDEditor
            value={typeof value === 'string' ? value : ''}
            onChange={(val) => onChange(val ?? '')}
            height={300}
            preview="live"
          />
        </div>
      )}

      {field.type === 'json' && (
        <div>
          <textarea
            className={`w-full font-mono text-xs rounded-lg border px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y ${
              jsonError ? 'border-red-400 bg-red-50' : 'border-slate-200 bg-white'
            }`}
            rows={10}
            value={
              typeof value === 'string'
                ? value
                : JSON.stringify(value ?? {}, null, 2)
            }
            onChange={e => onJsonChange(e.target.value)}
            spellCheck={false}
          />
          {jsonError && (
            <p className="mt-1 text-xs text-red-600">{jsonError}</p>
          )}
        </div>
      )}

      {field.type === 'number' && (
        <input
          type="number"
          className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={typeof value === 'number' ? value : Number(value) || 0}
          min={'min' in field ? field.min : undefined}
          max={'max' in field ? field.max : undefined}
          step={'step' in field ? field.step : 1}
          onChange={e => onChange(Number(e.target.value))}
        />
      )}

      {field.type === 'text' && (
        <input
          type="text"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={typeof value === 'string' ? value : String(value ?? '')}
          onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
```

**Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors. Fix any type errors before committing.

**Step 4: Commit**

```bash
git add frontend/src/pages/admin/AdminAgentConfig.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add AdminAgentConfig page with markdown editor, json, and number fields"
```

---

## Task 10: Update App.tsx + AdminNav

**Files:**
- Modify: `frontend/src/App.tsx`

**Step 1: Read current App.tsx** (already read — see context above)

**Step 2: Add import for AdminAgentConfig**

After the `import AdminStats from './pages/admin/AdminStats';` line, add:

```typescript
import AdminAgentConfig from './pages/admin/AdminAgentConfig';
```

**Step 3: Add "Agents" link to AdminNav**

In the `AdminNav` function, add after `<NavItem to="/admin/stats" label="Stats" />`:

```tsx
<NavItem to="/admin/agents" label="Agents" />
```

**Step 4: Add routes for agent config pages**

After the existing admin routes (`/admin/users`, `/admin/stats`), add:

```tsx
<Route path="/admin/agents" element={<ProtectedRoute roles={['super_admin']}><AppLayout nav={<AdminNav />}><AdminAgentConfig /></AppLayout></ProtectedRoute>} />
<Route path="/admin/agents/:agent" element={<ProtectedRoute roles={['super_admin']}><AppLayout nav={<AdminNav />}><AdminAgentConfig /></AppLayout></ProtectedRoute>} />
```

**Step 5: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 6: Smoke test in browser**

1. Log in as `super_admin`
2. Navigate to `/admin/agents/scanner`
3. Verify sidebar shows all 6 agents
4. Verify scanner fields: Threshold (number), Skill Match Minimum (number), Keyword Groups (JSON textarea)
5. Change threshold to 70, click Save — verify green "✓ Saved" toast
6. Navigate to `/admin/agents/analyzer` — verify Skill Profile shows markdown editor with split preview
7. Navigate to `/admin/agents/bidder` — verify Proposal System Prompt shows markdown editor

**Step 7: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: add /admin/agents routes and Agents link to AdminNav"
```

---

## Final Verification

```bash
# 1. All backend specs pass
docker compose exec api bundle exec rspec spec/ --format progress

# 2. Frontend TypeScript compiles cleanly
cd frontend && npx tsc --noEmit

# 3. Seed defaults are present
docker compose exec api bundle exec rails runner "puts AgentConfig.count"
# Expected: 6

# 4. API smoke test
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/sessions \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}' | jq -r .token)

curl -s http://localhost:3000/api/v1/admin/agents \
  -H "Authorization: Bearer $TOKEN" | jq '.agents | length'
# Expected: 6

curl -s http://localhost:3000/api/v1/admin/agents/analyzer \
  -H "Authorization: Bearer $TOKEN" | jq '.agent.config | keys'
# Expected: ["max_tokens","model_id","skill_profile","temperature"]
```
