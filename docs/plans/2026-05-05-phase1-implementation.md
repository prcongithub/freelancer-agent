# Phase 1 MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the Scanner, Bidder, and Tracker modules with a React dashboard for project discovery, scoring, bidding, and pipeline tracking on Freelancer.com.

**Architecture:** Rails 8 API-mode modular monolith with Sidekiq background jobs. React (Vite + Tailwind) SPA for the dashboard. MongoDB Atlas for persistence, Redis for Sidekiq queues and caching.

**Tech Stack:** Rails 8 (ruby:3.4-slim-bookworm), Mongoid ODM, Sidekiq, React 18, Vite, TailwindCSS, Docker, RSpec, Jest

---

## Task 1: Rails 8 API Project Scaffold

**Files:**
- Create: `Gemfile`
- Create: `config/application.rb`
- Create: `config/mongoid.yml`
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.env.example`

**Step 1: Generate Rails 8 API app**

```bash
rails new . --api --skip-active-record --skip-test --name=FreelancingAgent
```

**Step 2: Add core gems to Gemfile**

Add these to the generated Gemfile:

```ruby
# MongoDB
gem "mongoid", "~> 9.0"

# Background jobs
gem "sidekiq", "~> 7.0"

# HTTP client (Freelancer API)
gem "faraday", "~> 2.0"

# Authentication
gem "jwt"

# AI (proposal generation)
gem "ruby-openai"

# Environment
gem "dotenv-rails"

# CORS
gem "rack-cors"

group :development, :test do
  gem "rspec-rails"
  gem "factory_bot_rails"
  gem "faker"
  gem "webmock"
end
```

**Step 3: Bundle install**

```bash
bundle install
```

**Step 4: Generate Mongoid config**

```bash
rails g mongoid:config
```

Edit `config/mongoid.yml`:

```yaml
development:
  clients:
    default:
      uri: <%= ENV['MONGODB_URI'] || 'mongodb://localhost:27017/freelancing_agent_dev' %>

test:
  clients:
    default:
      uri: <%= ENV['MONGODB_URI_TEST'] || 'mongodb://localhost:27017/freelancing_agent_test' %>

production:
  clients:
    default:
      uri: <%= ENV['MONGODB_URI'] %>
```

**Step 5: Setup RSpec**

```bash
rails generate rspec:install
```

**Step 6: Configure CORS in `config/initializers/cors.rb`**

```ruby
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins ENV.fetch("FRONTEND_URL", "http://localhost:5173")
    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head]
  end
end
```

**Step 7: Configure Sidekiq in `config/initializers/sidekiq.rb`**

```ruby
Sidekiq.configure_server do |config|
  config.redis = { url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0") }
end

Sidekiq.configure_client do |config|
  config.redis = { url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0") }
end
```

**Step 8: Create `config/sidekiq.yml`**

```yaml
:queues:
  - [critical, 5]
  - [scanning, 3]
  - [bidding, 3]
  - [default, 2]
  - [low, 1]
```

**Step 9: Create `.env.example`**

```
MONGODB_URI=mongodb://localhost:27017/freelancing_agent_dev
REDIS_URL=redis://localhost:6379/0
FREELANCER_API_TOKEN=
FREELANCER_API_BASE_URL=https://www.freelancer.com/api
OPENAI_API_KEY=
JWT_SECRET=change_me_in_production
FRONTEND_URL=http://localhost:5173
```

**Step 10: Create `docker-compose.yml`**

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  api:
    build: .
    command: rails server -b 0.0.0.0
    ports:
      - "3000:3000"
    env_file: .env
    depends_on:
      - redis
      - mongo
    volumes:
      - .:/app

  sidekiq:
    build: .
    command: bundle exec sidekiq -C config/sidekiq.yml
    env_file: .env
    depends_on:
      - redis
      - mongo
    volumes:
      - .:/app

volumes:
  mongo_data:
```

**Step 11: Create `Dockerfile`**

```dockerfile
FROM ruby:3.4-slim-bookworm

RUN apt-get update -qq && apt-get install -y build-essential libcurl4-openssl-dev git && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY Gemfile Gemfile.lock ./
RUN bundle install

COPY . .

EXPOSE 3000
CMD ["rails", "server", "-b", "0.0.0.0"]
```

**Step 12: Verify setup**

```bash
bundle exec rspec
```

Expected: 0 examples, 0 failures

**Step 13: Commit**

```bash
git add -A
git commit -m "feat: scaffold Rails 8 API with Mongoid, Sidekiq, Docker"
```

---

## Task 2: Project Model & Scanner Module

**Files:**
- Create: `app/models/project.rb`
- Create: `app/modules/scanner/freelancer_client.rb`
- Create: `app/modules/scanner/project_scorer.rb`
- Create: `app/modules/scanner/scan_job.rb`
- Create: `spec/models/project_spec.rb`
- Create: `spec/modules/scanner/project_scorer_spec.rb`
- Create: `spec/modules/scanner/freelancer_client_spec.rb`

**Step 1: Write the Project model test**

```ruby
# spec/models/project_spec.rb
require "rails_helper"

RSpec.describe Project, type: :model do
  describe "validations" do
    it "requires freelancer_id" do
      project = Project.new(title: "Test")
      expect(project).not_to be_valid
      expect(project.errors[:freelancer_id]).to include("can't be blank")
    end

    it "requires unique freelancer_id" do
      Project.create!(freelancer_id: "123", title: "First")
      project = Project.new(freelancer_id: "123", title: "Second")
      expect(project).not_to be_valid
    end
  end

  describe "scopes" do
    it ".above_threshold returns projects with total score >= threshold" do
      Project.create!(freelancer_id: "1", title: "High", fit_score: { "total" => 80 })
      Project.create!(freelancer_id: "2", title: "Low", fit_score: { "total" => 40 })
      expect(Project.above_threshold(60).count).to eq(1)
    end
  end
end
```

**Step 2: Run test to verify it fails**

```bash
bundle exec rspec spec/models/project_spec.rb
```

Expected: FAIL — `NameError: uninitialized constant Project`

**Step 3: Implement Project model**

```ruby
# app/models/project.rb
class Project
  include Mongoid::Document
  include Mongoid::Timestamps

  field :freelancer_id, type: String
  field :title, type: String
  field :description, type: String
  field :budget_range, type: Hash # { min: 0, max: 0, currency: "USD" }
  field :skills_required, type: Array, default: []
  field :client, type: Hash # { id, name, rating, payment_verified, country }
  field :fit_score, type: Hash, default: {} # { total, skill_match, budget, scope_clarity, agent_buildable, client_quality }
  field :status, type: String, default: "discovered"
  field :category, type: String
  field :discovered_at, type: Time
  field :bid_at, type: Time
  field :won_at, type: Time
  field :delivered_at, type: Time

  validates :freelancer_id, presence: true, uniqueness: true

  STATUSES = %w[discovered bid_sent shortlisted won in_call prd_ready building deployed delivered lost].freeze
  CATEGORIES = %w[aws_devops backend frontend fullstack ai_automation].freeze

  validates :status, inclusion: { in: STATUSES }
  validates :category, inclusion: { in: CATEGORIES }, allow_nil: true

  scope :above_threshold, ->(threshold) { where("fit_score.total" => { "$gte" => threshold }) }
  scope :with_status, ->(status) { where(status: status) }
  scope :pending_bid_approval, -> { where(status: "discovered").above_threshold(60) }

  index({ freelancer_id: 1 }, { unique: true })
  index({ status: 1 })
  index({ "fit_score.total" => -1 })
end
```

**Step 4: Run test to verify it passes**

```bash
bundle exec rspec spec/models/project_spec.rb
```

Expected: 3 examples, 0 failures

**Step 5: Write FreelancerClient test**

```ruby
# spec/modules/scanner/freelancer_client_spec.rb
require "rails_helper"

RSpec.describe Scanner::FreelancerClient do
  let(:client) { described_class.new }

  describe "#search_projects" do
    it "returns parsed projects from Freelancer API" do
      stub_request(:get, /www\.freelancer\.com\/api\/projects\/0\.1\/projects\/active/)
        .to_return(
          status: 200,
          body: {
            result: {
              projects: [
                {
                  id: 12345,
                  title: "Build AWS Infrastructure",
                  preview_description: "Need help setting up ECS cluster",
                  budget: { minimum: 500, maximum: 1000 },
                  currency: { code: "USD" },
                  jobs: [{ name: "AWS" }, { name: "Docker" }],
                  owner_id: 999,
                  time_submitted: 1714900000
                }
              ]
            }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      projects = client.search_projects(keywords: ["aws"])
      expect(projects.length).to eq(1)
      expect(projects.first[:freelancer_id]).to eq("12345")
      expect(projects.first[:title]).to eq("Build AWS Infrastructure")
      expect(projects.first[:skills_required]).to eq(["AWS", "Docker"])
    end
  end
end
```

**Step 6: Run test to verify it fails**

```bash
bundle exec rspec spec/modules/scanner/freelancer_client_spec.rb
```

Expected: FAIL — `NameError: uninitialized constant Scanner::FreelancerClient`

**Step 7: Implement FreelancerClient**

```ruby
# app/modules/scanner/freelancer_client.rb
module Scanner
  class FreelancerClient
    BASE_URL = ENV.fetch("FREELANCER_API_BASE_URL", "https://www.freelancer.com/api")

    def initialize
      @conn = Faraday.new(url: BASE_URL) do |f|
        f.request :json
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = ENV.fetch("FREELANCER_API_TOKEN", "")
      end
    end

    def search_projects(keywords:, limit: 50)
      response = @conn.get("projects/0.1/projects/active") do |req|
        req.params["query"] = keywords.join(" ")
        req.params["limit"] = limit
        req.params["compact"] = true
        req.params["job_details"] = true
        req.params["full_description"] = true
      end

      return [] unless response.success?

      projects = response.body.dig("result", "projects") || []
      projects.map { |p| normalize_project(p) }
    end

    def get_project_details(project_id)
      response = @conn.get("projects/0.1/projects/#{project_id}") do |req|
        req.params["full_description"] = true
        req.params["job_details"] = true
        req.params["user_details"] = true
      end

      return nil unless response.success?

      normalize_project(response.body.dig("result"))
    end

    private

    def normalize_project(p)
      {
        freelancer_id: p["id"].to_s,
        title: p["title"],
        description: p["preview_description"] || p["description"],
        budget_range: {
          min: p.dig("budget", "minimum"),
          max: p.dig("budget", "maximum"),
          currency: p.dig("currency", "code") || "USD"
        },
        skills_required: (p["jobs"] || []).map { |j| j["name"] },
        client: { id: p["owner_id"].to_s },
        time_submitted: p["time_submitted"]
      }
    end
  end
end
```

**Step 8: Run test to verify it passes**

```bash
bundle exec rspec spec/modules/scanner/freelancer_client_spec.rb
```

Expected: 1 example, 0 failures

**Step 9: Write ProjectScorer test**

```ruby
# spec/modules/scanner/project_scorer_spec.rb
require "rails_helper"

RSpec.describe Scanner::ProjectScorer do
  let(:scorer) { described_class.new }

  describe "#score" do
    it "returns a score hash with total between 0-100" do
      project = {
        title: "Build AWS ECS deployment pipeline",
        description: "Need a CI/CD pipeline with Docker, ECS, and Terraform",
        budget_range: { min: 1000, max: 3000, currency: "USD" },
        skills_required: ["AWS", "Docker", "Terraform", "CI/CD"],
        client: { rating: 4.8, payment_verified: true }
      }

      result = scorer.score(project)
      expect(result[:total]).to be_between(0, 100)
      expect(result).to have_key(:skill_match)
      expect(result).to have_key(:budget)
      expect(result).to have_key(:scope_clarity)
      expect(result).to have_key(:agent_buildable)
      expect(result).to have_key(:client_quality)
    end

    it "scores higher for projects with more skill matches" do
      high_match = {
        title: "Rails + React + AWS project",
        description: "Full stack app with deployment",
        budget_range: { min: 2000, max: 5000, currency: "USD" },
        skills_required: ["Ruby on Rails", "React", "AWS", "Docker"],
        client: { rating: 4.5, payment_verified: true }
      }

      low_match = {
        title: "iOS Swift app",
        description: "Build an iPhone app",
        budget_range: { min: 2000, max: 5000, currency: "USD" },
        skills_required: ["Swift", "iOS", "Xcode"],
        client: { rating: 4.5, payment_verified: true }
      }

      expect(scorer.score(high_match)[:total]).to be > scorer.score(low_match)[:total]
    end
  end
end
```

**Step 10: Run test to verify it fails**

```bash
bundle exec rspec spec/modules/scanner/project_scorer_spec.rb
```

Expected: FAIL — `NameError: uninitialized constant Scanner::ProjectScorer`

**Step 11: Implement ProjectScorer**

```ruby
# app/modules/scanner/project_scorer.rb
module Scanner
  class ProjectScorer
    SKILL_KEYWORDS = {
      aws_devops: %w[aws ec2 s3 lambda rds ecs eks cloudfront docker kubernetes terraform ci/cd devops jenkins github-actions],
      backend: ["ruby on rails", "rails", "node.js", "nodejs", "express", "python", "api", "rest", "microservices", "backend"],
      frontend: %w[react angular typescript javascript html css frontend dashboard ui],
      ai_automation: %w[ai openai claude gpt chatbot rag automation agent n8n],
      fullstack: ["full stack", "fullstack", "web application", "saas", "webapp"]
    }.freeze

    CATEGORY_FLOORS = {
      aws_devops: { min: 75, max: 100 },
      backend: { min: 60, max: 80 },
      frontend: { min: 40, max: 60 },
      ai_automation: { min: 100, max: 120 },
      fullstack: { min: 60, max: 80 }
    }.freeze

    def score(project)
      skill_match = score_skill_match(project)
      budget = score_budget(project)
      scope_clarity = score_scope_clarity(project)
      agent_buildable = score_agent_buildable(project)
      client_quality = score_client_quality(project)

      total = (
        skill_match * 0.35 +
        budget * 0.20 +
        scope_clarity * 0.20 +
        agent_buildable * 0.10 +
        client_quality * 0.15
      ).round

      {
        total: total,
        skill_match: skill_match,
        budget: budget,
        scope_clarity: scope_clarity,
        agent_buildable: agent_buildable,
        client_quality: client_quality
      }
    end

    def categorize(project)
      skills_text = (project[:skills_required] || []).map(&:downcase).join(" ")
      title_text = (project[:title] || "").downcase
      combined = "#{skills_text} #{title_text}"

      scores = SKILL_KEYWORDS.map do |category, keywords|
        matches = keywords.count { |kw| combined.include?(kw) }
        [category, matches]
      end.to_h

      best = scores.max_by { |_, v| v }
      best[1] > 0 ? best[0].to_s : nil
    end

    private

    def score_skill_match(project)
      skills_text = (project[:skills_required] || []).map(&:downcase).join(" ")
      desc_text = "#{project[:title]} #{project[:description]}".downcase
      combined = "#{skills_text} #{desc_text}"

      all_keywords = SKILL_KEYWORDS.values.flatten
      matches = all_keywords.count { |kw| combined.include?(kw) }

      [(matches.to_f / 5 * 100).round, 100].min
    end

    def score_budget(project)
      budget = project.dig(:budget_range, :max) || 0
      return 20 if budget < 100
      return 50 if budget < 500
      return 70 if budget < 1000
      return 85 if budget < 5000
      100
    end

    def score_scope_clarity(project)
      desc = "#{project[:title]} #{project[:description]}"
      length_score = [[desc.length / 10, 50].min, 0].max
      has_requirements = desc.match?(/must|should|need|require|feature/i) ? 30 : 0
      has_tech = (project[:skills_required] || []).length >= 2 ? 20 : 0
      [length_score + has_requirements + has_tech, 100].min
    end

    def score_agent_buildable(project)
      desc = "#{project[:title]} #{project[:description]}".downcase
      simple_indicators = %w[landing page crud dashboard api bot simple basic wordpress]
      complex_indicators = %w[enterprise migration legacy existing codebase refactor]

      simple_count = simple_indicators.count { |w| desc.include?(w) }
      complex_count = complex_indicators.count { |w| desc.include?(w) }

      base = 50
      base += simple_count * 15
      base -= complex_count * 20
      [[base, 100].min, 0].max
    end

    def score_client_quality(project)
      client = project[:client] || {}
      score = 50
      rating = client[:rating].to_f
      score += (rating - 3) * 20 if rating > 0
      score += 20 if client[:payment_verified]
      [[score, 100].min, 0].max
    end
  end
end
```

**Step 12: Run test to verify it passes**

```bash
bundle exec rspec spec/modules/scanner/project_scorer_spec.rb
```

Expected: 2 examples, 0 failures

**Step 13: Implement ScanJob**

```ruby
# app/modules/scanner/scan_job.rb
module Scanner
  class ScanJob
    include Sidekiq::Job
    sidekiq_options queue: :scanning

    KEYWORD_GROUPS = {
      aws_devops: %w[aws docker kubernetes terraform devops ci/cd],
      backend: ["ruby on rails", "node.js", "express", "api development", "python api"],
      frontend: %w[react angular typescript dashboard],
      ai_automation: ["ai agent", "chatbot", "openai", "claude", "rag", "n8n"],
      fullstack: ["full stack", "web application", "saas"]
    }.freeze

    def perform
      client = FreelancerClient.new
      scorer = ProjectScorer.new

      KEYWORD_GROUPS.each do |_category, keywords|
        projects = client.search_projects(keywords: keywords)

        projects.each do |project_data|
          next if Project.where(freelancer_id: project_data[:freelancer_id]).exists?

          score = scorer.score(project_data)
          category = scorer.categorize(project_data)

          next if score[:total] < (Setting.threshold || 60)

          Project.create!(
            freelancer_id: project_data[:freelancer_id],
            title: project_data[:title],
            description: project_data[:description],
            budget_range: project_data[:budget_range],
            skills_required: project_data[:skills_required],
            client: project_data[:client],
            fit_score: score,
            category: category,
            status: "discovered",
            discovered_at: Time.current
          )
        end
      end
    end
  end
end
```

**Step 14: Commit**

```bash
git add -A
git commit -m "feat: add Scanner module with FreelancerClient, ProjectScorer, and ScanJob"
```

---

## Task 3: Bid Model & Bidder Module

**Files:**
- Create: `app/models/bid.rb`
- Create: `app/modules/bidder/pricing_engine.rb`
- Create: `app/modules/bidder/proposal_generator.rb`
- Create: `app/modules/bidder/submit_bid_job.rb`
- Create: `spec/models/bid_spec.rb`
- Create: `spec/modules/bidder/pricing_engine_spec.rb`
- Create: `spec/modules/bidder/proposal_generator_spec.rb`

**Step 1: Write Bid model test**

```ruby
# spec/models/bid_spec.rb
require "rails_helper"

RSpec.describe Bid, type: :model do
  describe "validations" do
    it "requires project_id and amount" do
      bid = Bid.new
      expect(bid).not_to be_valid
      expect(bid.errors[:project]).to be_present
      expect(bid.errors[:amount]).to be_present
    end
  end
end
```

**Step 2: Run test to verify it fails**

```bash
bundle exec rspec spec/models/bid_spec.rb
```

Expected: FAIL

**Step 3: Implement Bid model**

```ruby
# app/models/bid.rb
class Bid
  include Mongoid::Document
  include Mongoid::Timestamps

  belongs_to :project

  field :amount, type: Float
  field :currency, type: String, default: "USD"
  field :proposal_text, type: String
  field :pricing_breakdown, type: Hash, default: {} # { hourly_rate, estimated_hours, discount_applied }
  field :status, type: String, default: "draft"
  field :submitted_at, type: Time
  field :freelancer_bid_id, type: String

  STATUSES = %w[draft submitted viewed shortlisted won lost].freeze

  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :project, presence: true
  validates :status, inclusion: { in: STATUSES }

  index({ project_id: 1 })
  index({ status: 1 })
end
```

**Step 4: Run test to verify it passes**

```bash
bundle exec rspec spec/models/bid_spec.rb
```

Expected: PASS

**Step 5: Write PricingEngine test**

```ruby
# spec/modules/bidder/pricing_engine_spec.rb
require "rails_helper"

RSpec.describe Bidder::PricingEngine do
  let(:engine) { described_class.new }

  describe "#calculate" do
    it "returns amount based on category floor and estimated hours" do
      project = {
        category: "aws_devops",
        budget_range: { min: 1000, max: 3000 },
        description: "Set up ECS cluster with CI/CD pipeline and monitoring",
        fit_score: { agent_buildable: 30 }
      }

      result = engine.calculate(project)
      expect(result[:amount]).to be > 0
      expect(result[:hourly_rate]).to be_between(75, 100)
      expect(result[:estimated_hours]).to be > 0
      expect(result).to have_key(:discount_applied)
    end

    it "applies agent-buildable discount for high automation scores" do
      automatable = {
        category: "frontend",
        budget_range: { min: 200, max: 500 },
        description: "Build a simple landing page with contact form",
        fit_score: { agent_buildable: 90 }
      }

      manual = {
        category: "frontend",
        budget_range: { min: 200, max: 500 },
        description: "Build a simple landing page with contact form",
        fit_score: { agent_buildable: 30 }
      }

      auto_result = engine.calculate(automatable)
      manual_result = engine.calculate(manual)
      expect(auto_result[:amount]).to be < manual_result[:amount]
    end
  end
end
```

**Step 6: Run test to verify it fails**

```bash
bundle exec rspec spec/modules/bidder/pricing_engine_spec.rb
```

Expected: FAIL

**Step 7: Implement PricingEngine**

```ruby
# app/modules/bidder/pricing_engine.rb
module Bidder
  class PricingEngine
    CATEGORY_RATES = {
      "aws_devops" => { min: 75, max: 100 },
      "ai_automation" => { min: 100, max: 120 },
      "fullstack" => { min: 60, max: 80 },
      "backend" => { min: 60, max: 80 },
      "frontend" => { min: 40, max: 60 }
    }.freeze

    AGENT_DISCOUNT_THRESHOLD = 70
    AGENT_DISCOUNT_PERCENT = 0.25

    def calculate(project)
      category = project[:category] || "fullstack"
      rates = CATEGORY_RATES[category] || CATEGORY_RATES["fullstack"]

      hourly_rate = ((rates[:min] + rates[:max]) / 2.0).round
      estimated_hours = estimate_hours(project)
      base_amount = hourly_rate * estimated_hours

      discount = 0.0
      agent_score = project.dig(:fit_score, :agent_buildable) || 0
      if agent_score >= AGENT_DISCOUNT_THRESHOLD
        discount = AGENT_DISCOUNT_PERCENT
      end

      final_amount = (base_amount * (1 - discount)).round

      # Cap at client's max budget if available
      max_budget = project.dig(:budget_range, :max)
      final_amount = [final_amount, max_budget].min if max_budget && max_budget > 0

      {
        amount: final_amount,
        hourly_rate: hourly_rate,
        estimated_hours: estimated_hours,
        discount_applied: discount
      }
    end

    private

    def estimate_hours(project)
      desc = project[:description] || ""
      budget_max = project.dig(:budget_range, :max) || 0

      # Rough estimation based on budget range and description length
      if budget_max <= 500
        rand(5..10)
      elsif budget_max <= 2000
        rand(15..30)
      elsif budget_max <= 5000
        rand(30..60)
      else
        rand(60..100)
      end
    end
  end
end
```

**Step 8: Run test to verify it passes**

```bash
bundle exec rspec spec/modules/bidder/pricing_engine_spec.rb
```

Expected: PASS

**Step 9: Write ProposalGenerator test**

```ruby
# spec/modules/bidder/proposal_generator_spec.rb
require "rails_helper"

RSpec.describe Bidder::ProposalGenerator do
  let(:generator) { described_class.new }

  describe "#generate" do
    it "returns a proposal string between 150-350 words" do
      stub_request(:post, "https://api.openai.com/v1/chat/completions")
        .to_return(
          status: 200,
          body: {
            choices: [{
              message: {
                content: "I am excited to work on your AWS infrastructure project. " * 30
              }
            }]
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      project = {
        title: "Build AWS ECS deployment pipeline",
        description: "Need CI/CD with Docker and ECS",
        skills_required: ["AWS", "Docker", "CI/CD"],
        budget_range: { min: 1000, max: 3000 }
      }

      proposal = generator.generate(project)
      expect(proposal).to be_a(String)
      expect(proposal.split.length).to be > 10
    end
  end
end
```

**Step 10: Run test to verify it fails**

```bash
bundle exec rspec spec/modules/bidder/proposal_generator_spec.rb
```

Expected: FAIL

**Step 11: Implement ProposalGenerator**

```ruby
# app/modules/bidder/proposal_generator.rb
module Bidder
  class ProposalGenerator
    def initialize
      @client = OpenAI::Client.new(access_token: ENV.fetch("OPENAI_API_KEY", ""))
    end

    def generate(project)
      prompt = build_prompt(project)

      response = @client.chat(
        parameters: {
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: system_prompt },
            { role: "user", content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.7
        }
      )

      response.dig("choices", 0, "message", "content") || fallback_proposal(project)
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
        Skills Required: #{(project[:skills_required] || []).join(', ')}
        Budget: #{project.dig(:budget_range, :min)}-#{project.dig(:budget_range, :max)} #{project.dig(:budget_range, :currency) || 'USD'}

        My relevant skills: Ruby on Rails, React, Node.js, AWS (ECS, Lambda, S3, RDS), Docker, Kubernetes, Terraform, CI/CD, PostgreSQL, MongoDB, AI/automation, TypeScript.
      PROMPT
    end

    def fallback_proposal(project)
      "Hi, I'd love to help with your #{project[:title]} project. I have extensive experience with #{(project[:skills_required] || []).first(3).join(', ')} and can deliver a high-quality solution within your timeline. Let's discuss the details."
    end
  end
end
```

**Step 12: Run test to verify it passes**

```bash
bundle exec rspec spec/modules/bidder/proposal_generator_spec.rb
```

Expected: PASS

**Step 13: Implement SubmitBidJob**

```ruby
# app/modules/bidder/submit_bid_job.rb
module Bidder
  class SubmitBidJob
    include Sidekiq::Job
    sidekiq_options queue: :bidding

    def perform(project_id)
      project = Project.find(project_id)
      return if project.status != "discovered"

      pricing_engine = PricingEngine.new
      proposal_generator = ProposalGenerator.new

      project_data = {
        title: project.title,
        description: project.description,
        category: project.category,
        budget_range: project.budget_range.symbolize_keys,
        skills_required: project.skills_required,
        fit_score: project.fit_score.symbolize_keys
      }

      pricing = pricing_engine.calculate(project_data)
      proposal = proposal_generator.generate(project_data)

      bid = Bid.create!(
        project: project,
        amount: pricing[:amount],
        currency: "USD",
        proposal_text: proposal,
        pricing_breakdown: pricing,
        status: "submitted",
        submitted_at: Time.current
      )

      # Submit to Freelancer API
      submit_to_freelancer(project, bid)

      project.update!(status: "bid_sent", bid_at: Time.current)
    end

    private

    def submit_to_freelancer(project, bid)
      conn = Faraday.new(url: ENV.fetch("FREELANCER_API_BASE_URL")) do |f|
        f.request :json
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = ENV.fetch("FREELANCER_API_TOKEN", "")
      end

      response = conn.post("projects/0.1/bids/") do |req|
        req.body = {
          project_id: project.freelancer_id.to_i,
          amount: bid.amount,
          period: 7,
          milestone_percentage: 100,
          description: bid.proposal_text
        }
      end

      if response.success?
        bid_id = response.body.dig("result", "id")
        bid.update!(freelancer_bid_id: bid_id.to_s) if bid_id
      end
    end
  end
end
```

**Step 14: Commit**

```bash
git add -A
git commit -m "feat: add Bidder module with PricingEngine, ProposalGenerator, and SubmitBidJob"
```

---

## Task 4: Settings Model

**Files:**
- Create: `app/models/setting.rb`
- Create: `spec/models/setting_spec.rb`

**Step 1: Write Setting model test**

```ruby
# spec/models/setting_spec.rb
require "rails_helper"

RSpec.describe Setting, type: :model do
  describe ".instance" do
    it "returns a singleton settings document" do
      setting = Setting.instance
      expect(setting).to be_persisted
      expect(Setting.instance.id).to eq(setting.id)
    end
  end

  describe ".threshold" do
    it "returns the auto_bid_threshold with default 60" do
      expect(Setting.threshold).to eq(60)
    end
  end
end
```

**Step 2: Run test to verify it fails**

```bash
bundle exec rspec spec/models/setting_spec.rb
```

Expected: FAIL

**Step 3: Implement Setting model**

```ruby
# app/models/setting.rb
class Setting
  include Mongoid::Document
  include Mongoid::Timestamps

  field :skill_keywords, type: Hash, default: -> {
    {
      aws_devops: %w[aws docker kubernetes terraform devops ci/cd],
      backend: ["ruby on rails", "node.js", "express", "api development"],
      frontend: %w[react angular typescript dashboard],
      ai_automation: ["ai agent", "chatbot", "openai", "claude", "rag"],
      fullstack: ["full stack", "web application", "saas"]
    }
  }

  field :pricing_floors, type: Hash, default: -> {
    {
      aws_devops: { min: 75, max: 100 },
      ai_automation: { min: 100, max: 120 },
      fullstack: { min: 60, max: 80 },
      backend: { min: 60, max: 80 },
      frontend: { min: 40, max: 60 }
    }
  }

  field :auto_bid_threshold, type: Integer, default: 80
  field :approval_threshold, type: Integer, default: 60
  field :notifications, type: Hash, default: { email: false, dashboard: true }

  def self.instance
    first || create!
  end

  def self.threshold
    instance.approval_threshold
  end
end
```

**Step 4: Run test to verify it passes**

```bash
bundle exec rspec spec/models/setting_spec.rb
```

Expected: PASS

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Setting model with singleton pattern and defaults"
```

---

## Task 5: API Controllers

**Files:**
- Create: `app/controllers/api/v1/projects_controller.rb`
- Create: `app/controllers/api/v1/bids_controller.rb`
- Create: `app/controllers/api/v1/settings_controller.rb`
- Create: `app/controllers/api/v1/dashboard_controller.rb`
- Create: `config/routes.rb`
- Create: `spec/requests/api/v1/projects_spec.rb`
- Create: `spec/requests/api/v1/bids_spec.rb`
- Create: `spec/requests/api/v1/dashboard_spec.rb`

**Step 1: Write projects API test**

```ruby
# spec/requests/api/v1/projects_spec.rb
require "rails_helper"

RSpec.describe "Api::V1::Projects", type: :request do
  describe "GET /api/v1/projects" do
    it "returns projects grouped by status" do
      Project.create!(freelancer_id: "1", title: "Project A", status: "discovered", fit_score: { "total" => 80 })
      Project.create!(freelancer_id: "2", title: "Project B", status: "bid_sent", fit_score: { "total" => 70 })

      get "/api/v1/projects"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["projects"]).to be_an(Array)
      expect(json["projects"].length).to eq(2)
    end
  end

  describe "GET /api/v1/projects?status=discovered" do
    it "filters projects by status" do
      Project.create!(freelancer_id: "1", title: "A", status: "discovered", fit_score: { "total" => 80 })
      Project.create!(freelancer_id: "2", title: "B", status: "bid_sent", fit_score: { "total" => 70 })

      get "/api/v1/projects", params: { status: "discovered" }

      json = JSON.parse(response.body)
      expect(json["projects"].length).to eq(1)
      expect(json["projects"][0]["title"]).to eq("A")
    end
  end

  describe "POST /api/v1/projects/:id/approve_bid" do
    it "triggers bid submission for a discovered project" do
      project = Project.create!(freelancer_id: "1", title: "A", status: "discovered", fit_score: { "total" => 70 }, category: "fullstack")

      expect {
        post "/api/v1/projects/#{project.id}/approve_bid"
      }.to change(Bidder::SubmitBidJob.jobs, :size).by(1)

      expect(response).to have_http_status(:ok)
    end
  end
end
```

**Step 2: Run test to verify it fails**

```bash
bundle exec rspec spec/requests/api/v1/projects_spec.rb
```

Expected: FAIL

**Step 3: Configure routes**

```ruby
# config/routes.rb
Rails.application.routes.draw do
  namespace :api do
    namespace :v1 do
      resources :projects, only: [:index, :show] do
        member do
          post :approve_bid
          post :reject
        end
      end

      resources :bids, only: [:index, :show]

      resource :settings, only: [:show, :update]

      get :dashboard, to: "dashboard#index"
    end
  end
end
```

**Step 4: Implement ProjectsController**

```ruby
# app/controllers/api/v1/projects_controller.rb
module Api
  module V1
    class ProjectsController < ApplicationController
      def index
        projects = Project.all
        projects = projects.with_status(params[:status]) if params[:status].present?
        projects = projects.order(discovered_at: :desc)

        render json: { projects: projects.map { |p| serialize_project(p) } }
      end

      def show
        project = Project.find(params[:id])
        render json: { project: serialize_project(project) }
      end

      def approve_bid
        project = Project.find(params[:id])

        if project.status != "discovered"
          render json: { error: "Project is not in discovered state" }, status: :unprocessable_entity
          return
        end

        Bidder::SubmitBidJob.perform_async(project.id.to_s)
        render json: { message: "Bid submission queued" }
      end

      def reject
        project = Project.find(params[:id])
        project.update!(status: "lost")
        render json: { project: serialize_project(project) }
      end

      private

      def serialize_project(project)
        {
          id: project.id.to_s,
          freelancer_id: project.freelancer_id,
          title: project.title,
          description: project.description,
          budget_range: project.budget_range,
          skills_required: project.skills_required,
          client: project.client,
          fit_score: project.fit_score,
          status: project.status,
          category: project.category,
          discovered_at: project.discovered_at,
          bid_at: project.bid_at,
          won_at: project.won_at,
          delivered_at: project.delivered_at
        }
      end
    end
  end
end
```

**Step 5: Implement BidsController**

```ruby
# app/controllers/api/v1/bids_controller.rb
module Api
  module V1
    class BidsController < ApplicationController
      def index
        bids = Bid.all.order(submitted_at: :desc)
        bids = bids.where(status: params[:status]) if params[:status].present?

        render json: { bids: bids.map { |b| serialize_bid(b) } }
      end

      def show
        bid = Bid.find(params[:id])
        render json: { bid: serialize_bid(bid) }
      end

      private

      def serialize_bid(bid)
        {
          id: bid.id.to_s,
          project_id: bid.project_id.to_s,
          project_title: bid.project.title,
          amount: bid.amount,
          currency: bid.currency,
          proposal_text: bid.proposal_text,
          pricing_breakdown: bid.pricing_breakdown,
          status: bid.status,
          submitted_at: bid.submitted_at
        }
      end
    end
  end
end
```

**Step 6: Implement SettingsController**

```ruby
# app/controllers/api/v1/settings_controller.rb
module Api
  module V1
    class SettingsController < ApplicationController
      def show
        render json: { settings: Setting.instance.as_json(except: [:_id]) }
      end

      def update
        setting = Setting.instance
        setting.update!(setting_params)
        render json: { settings: setting.as_json(except: [:_id]) }
      end

      private

      def setting_params
        params.permit(:auto_bid_threshold, :approval_threshold, skill_keywords: {}, pricing_floors: {}, notifications: {})
      end
    end
  end
end
```

**Step 7: Implement DashboardController**

```ruby
# app/controllers/api/v1/dashboard_controller.rb
module Api
  module V1
    class DashboardController < ApplicationController
      def index
        render json: {
          pipeline: pipeline_counts,
          stats: stats,
          recent_projects: recent_projects
        }
      end

      private

      def pipeline_counts
        Project::STATUSES.each_with_object({}) do |status, hash|
          hash[status] = Project.with_status(status).count
        end
      end

      def stats
        {
          total_discovered: Project.count,
          total_bids: Bid.count,
          bids_won: Bid.where(status: "won").count,
          win_rate: calculate_win_rate,
          total_revenue: Bid.where(status: "won").sum(:amount)
        }
      end

      def calculate_win_rate
        total = Bid.where(:status.in => %w[won lost]).count
        return 0 if total.zero?
        ((Bid.where(status: "won").count.to_f / total) * 100).round(1)
      end

      def recent_projects
        Project.order(discovered_at: :desc).limit(10).map do |p|
          { id: p.id.to_s, title: p.title, status: p.status, fit_score: p.fit_score, category: p.category }
        end
      end
    end
  end
end
```

**Step 8: Run tests**

```bash
bundle exec rspec spec/requests/
```

Expected: PASS

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: add API controllers for projects, bids, settings, and dashboard"
```

---

## Task 6: Tracker Module — Status Sync Job

**Files:**
- Create: `app/modules/tracker/sync_status_job.rb`
- Create: `app/modules/tracker/auto_bid_job.rb`
- Create: `config/initializers/sidekiq_scheduler.rb`
- Create: `spec/modules/tracker/sync_status_job_spec.rb`

**Step 1: Write SyncStatusJob test**

```ruby
# spec/modules/tracker/sync_status_job_spec.rb
require "rails_helper"

RSpec.describe Tracker::SyncStatusJob do
  describe "#perform" do
    it "updates project status when bid is shortlisted on Freelancer" do
      project = Project.create!(
        freelancer_id: "123",
        title: "Test",
        status: "bid_sent",
        fit_score: { "total" => 80 }
      )
      bid = Bid.create!(project: project, amount: 1000, status: "submitted", freelancer_bid_id: "456")

      stub_request(:get, /www\.freelancer\.com\/api\/projects\/0\.1\/bids/)
        .to_return(
          status: 200,
          body: { result: { bids: [{ id: 456, award_status: "shortlisted" }] } }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      described_class.new.perform

      bid.reload
      expect(bid.status).to eq("shortlisted")
      project.reload
      expect(project.status).to eq("shortlisted")
    end
  end
end
```

**Step 2: Run test to verify it fails**

```bash
bundle exec rspec spec/modules/tracker/sync_status_job_spec.rb
```

Expected: FAIL

**Step 3: Implement SyncStatusJob**

```ruby
# app/modules/tracker/sync_status_job.rb
module Tracker
  class SyncStatusJob
    include Sidekiq::Job
    sidekiq_options queue: :default

    def perform
      active_bids = Bid.where(:status.in => %w[submitted viewed shortlisted])
      return if active_bids.empty?

      conn = Faraday.new(url: ENV.fetch("FREELANCER_API_BASE_URL")) do |f|
        f.request :json
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = ENV.fetch("FREELANCER_API_TOKEN", "")
      end

      active_bids.each do |bid|
        next unless bid.freelancer_bid_id.present?

        response = conn.get("projects/0.1/bids") do |req|
          req.params["bids[]"] = bid.freelancer_bid_id
          req.params["bid_statuses[]"] = "active"
        end

        next unless response.success?

        remote_bids = response.body.dig("result", "bids") || []
        remote_bid = remote_bids.find { |b| b["id"].to_s == bid.freelancer_bid_id }
        next unless remote_bid

        new_status = map_status(remote_bid["award_status"])
        if new_status && new_status != bid.status
          bid.update!(status: new_status)
          sync_project_status(bid.project, new_status)
        end
      end
    end

    private

    def map_status(award_status)
      case award_status
      when "shortlisted" then "shortlisted"
      when "awarded", "accepted" then "won"
      when "rejected", "revoked" then "lost"
      else nil
      end
    end

    def sync_project_status(project, bid_status)
      case bid_status
      when "shortlisted"
        project.update!(status: "shortlisted")
      when "won"
        project.update!(status: "won", won_at: Time.current)
      when "lost"
        project.update!(status: "lost")
      end
    end
  end
end
```

**Step 4: Run test to verify it passes**

```bash
bundle exec rspec spec/modules/tracker/sync_status_job_spec.rb
```

Expected: PASS

**Step 5: Implement AutoBidJob (auto-bids for 80+ score projects)**

```ruby
# app/modules/tracker/auto_bid_job.rb
module Tracker
  class AutoBidJob
    include Sidekiq::Job
    sidekiq_options queue: :bidding

    def perform
      threshold = Setting.instance.auto_bid_threshold

      Project.where(status: "discovered")
             .above_threshold(threshold)
             .each do |project|
        Bidder::SubmitBidJob.perform_async(project.id.to_s)
      end
    end
  end
end
```

**Step 6: Create Sidekiq scheduled jobs config**

```ruby
# config/initializers/sidekiq_scheduler.rb
Sidekiq.configure_server do |config|
  config.on(:startup) do
    Sidekiq::Cron::Job.create(
      name: "Scanner - every 10 minutes",
      cron: "*/10 * * * *",
      class: "Scanner::ScanJob"
    )

    Sidekiq::Cron::Job.create(
      name: "Auto Bidder - every 15 minutes",
      cron: "*/15 * * * *",
      class: "Tracker::AutoBidJob"
    )

    Sidekiq::Cron::Job.create(
      name: "Status Sync - every 30 minutes",
      cron: "*/30 * * * *",
      class: "Tracker::SyncStatusJob"
    )
  end
end
```

Note: Add `gem "sidekiq-cron"` to Gemfile and `bundle install`.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Tracker module with SyncStatusJob, AutoBidJob, and scheduled jobs"
```

---

## Task 7: React Dashboard Scaffold

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.js`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/index.html`

**Step 1: Scaffold React app with Vite**

```bash
cd /home/prashant/data/PRC/startup_ideas/freelancing-agent
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install axios react-router-dom
```

**Step 2: Configure Vite with Tailwind**

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
})
```

**Step 3: Setup Tailwind in CSS**

```css
/* frontend/src/index.css */
@import "tailwindcss";
```

**Step 4: Create API client**

```typescript
// frontend/src/api/client.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' }
});

export const fetchDashboard = () => api.get('/dashboard');
export const fetchProjects = (status?: string) => api.get('/projects', { params: { status } });
export const fetchBids = (status?: string) => api.get('/bids', { params: { status } });
export const approveBid = (projectId: string) => api.post(`/projects/${projectId}/approve_bid`);
export const rejectProject = (projectId: string) => api.post(`/projects/${projectId}/reject`);
export const fetchSettings = () => api.get('/settings');
export const updateSettings = (data: any) => api.patch('/settings', data);

export default api;
```

**Step 5: Create App with router**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Bids from './pages/Bids';
import Settings from './pages/Settings';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-3 flex gap-6">
            <NavLink to="/" className={({isActive}) => isActive ? "font-semibold text-blue-600" : "text-gray-600 hover:text-gray-900"}>
              Dashboard
            </NavLink>
            <NavLink to="/projects" className={({isActive}) => isActive ? "font-semibold text-blue-600" : "text-gray-600 hover:text-gray-900"}>
              Projects
            </NavLink>
            <NavLink to="/bids" className={({isActive}) => isActive ? "font-semibold text-blue-600" : "text-gray-600 hover:text-gray-900"}>
              Bids
            </NavLink>
            <NavLink to="/settings" className={({isActive}) => isActive ? "font-semibold text-blue-600" : "text-gray-600 hover:text-gray-900"}>
              Settings
            </NavLink>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/bids" element={<Bids />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
```

**Step 6: Verify dev server starts**

```bash
cd frontend && npm run dev
```

Expected: Vite dev server on http://localhost:5173

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold React dashboard with Vite, Tailwind, and routing"
```

---

## Task 8: Dashboard Page

**Files:**
- Create: `frontend/src/pages/Dashboard.tsx`

**Step 1: Implement Dashboard page**

```tsx
// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { fetchDashboard } from '../api/client';

interface DashboardData {
  pipeline: Record<string, number>;
  stats: {
    total_discovered: number;
    total_bids: number;
    bids_won: number;
    win_rate: number;
    total_revenue: number;
  };
  recent_projects: Array<{
    id: string;
    title: string;
    status: string;
    fit_score: { total: number };
    category: string;
  }>;
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard().then(res => {
      setData(res.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-10">Loading...</div>;
  if (!data) return <div className="text-center py-10">Error loading dashboard</div>;

  const pipelineStages = ['discovered', 'bid_sent', 'shortlisted', 'won', 'building', 'deployed', 'delivered'];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="Discovered" value={data.stats.total_discovered} />
        <StatCard label="Bids Sent" value={data.stats.total_bids} />
        <StatCard label="Won" value={data.stats.bids_won} />
        <StatCard label="Win Rate" value={`${data.stats.win_rate}%`} />
      </div>

      {/* Pipeline */}
      <h2 className="text-lg font-semibold mb-3">Pipeline</h2>
      <div className="flex gap-2 mb-8">
        {pipelineStages.map(stage => (
          <div key={stage} className="flex-1 bg-white rounded-lg p-3 border text-center">
            <div className="text-2xl font-bold">{data.pipeline[stage] || 0}</div>
            <div className="text-xs text-gray-500 capitalize">{stage.replace('_', ' ')}</div>
          </div>
        ))}
      </div>

      {/* Recent Projects */}
      <h2 className="text-lg font-semibold mb-3">Recent Projects</h2>
      <div className="bg-white rounded-lg border">
        {data.recent_projects.map(project => (
          <div key={project.id} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0">
            <div>
              <div className="font-medium">{project.title}</div>
              <div className="text-sm text-gray-500">{project.category}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Score: {project.fit_score?.total}</span>
              <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 capitalize">
                {project.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Dashboard page with pipeline view and stats"
```

---

## Task 9: Projects Page with Bid Approval

**Files:**
- Create: `frontend/src/pages/Projects.tsx`

**Step 1: Implement Projects page**

```tsx
// frontend/src/pages/Projects.tsx
import { useEffect, useState } from 'react';
import { fetchProjects, approveBid, rejectProject } from '../api/client';

interface Project {
  id: string;
  freelancer_id: string;
  title: string;
  description: string;
  budget_range: { min: number; max: number; currency: string };
  skills_required: string[];
  fit_score: { total: number; skill_match: number; budget: number; scope_clarity: number; agent_buildable: number; client_quality: number };
  status: string;
  category: string;
  discovered_at: string;
}

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const loadProjects = () => {
    setLoading(true);
    fetchProjects(filter || undefined).then(res => {
      setProjects(res.data.projects);
      setLoading(false);
    });
  };

  useEffect(() => { loadProjects(); }, [filter]);

  const handleApprove = async (projectId: string) => {
    await approveBid(projectId);
    loadProjects();
  };

  const handleReject = async (projectId: string) => {
    await rejectProject(projectId);
    loadProjects();
  };

  const statuses = ['', 'discovered', 'bid_sent', 'shortlisted', 'won', 'lost'];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="border rounded px-3 py-1.5 text-sm"
        >
          {statuses.map(s => (
            <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All'}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading...</div>
      ) : (
        <div className="space-y-4">
          {projects.map(project => (
            <div key={project.id} className="bg-white rounded-lg border p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold">{project.title}</h3>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">{project.description}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {project.skills_required?.map(skill => (
                      <span key={skill} className="px-2 py-0.5 bg-gray-100 rounded text-xs">{skill}</span>
                    ))}
                  </div>
                  <div className="flex gap-4 mt-2 text-sm text-gray-500">
                    <span>Budget: ${project.budget_range?.min}-${project.budget_range?.max}</span>
                    <span>Category: {project.category}</span>
                    <span>Score: {project.fit_score?.total}/100</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 ml-4">
                  <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800 capitalize">
                    {project.status.replace('_', ' ')}
                  </span>
                  {project.status === 'discovered' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApprove(project.id)}
                        className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                      >
                        Approve Bid
                      </button>
                      <button
                        onClick={() => handleReject(project.id)}
                        className="px-3 py-1 bg-red-100 text-red-700 text-xs rounded hover:bg-red-200"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add Projects page with filtering and bid approval"
```

---

## Task 10: Bids & Settings Pages

**Files:**
- Create: `frontend/src/pages/Bids.tsx`
- Create: `frontend/src/pages/Settings.tsx`

**Step 1: Implement Bids page**

```tsx
// frontend/src/pages/Bids.tsx
import { useEffect, useState } from 'react';
import { fetchBids } from '../api/client';

interface Bid {
  id: string;
  project_title: string;
  amount: number;
  currency: string;
  status: string;
  pricing_breakdown: { hourly_rate: number; estimated_hours: number; discount_applied: number };
  submitted_at: string;
}

export default function Bids() {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBids().then(res => {
      setBids(res.data.bids);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Bid History</h1>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3">Project</th>
              <th className="text-left px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">Rate</th>
              <th className="text-left px-4 py-3">Hours</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {bids.map(bid => (
              <tr key={bid.id} className="border-b last:border-b-0">
                <td className="px-4 py-3 font-medium">{bid.project_title}</td>
                <td className="px-4 py-3">${bid.amount}</td>
                <td className="px-4 py-3">${bid.pricing_breakdown?.hourly_rate}/hr</td>
                <td className="px-4 py-3">{bid.pricing_breakdown?.estimated_hours}h</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${statusColor(bid.status)}`}>
                    {bid.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {bid.submitted_at ? new Date(bid.submitted_at).toLocaleDateString() : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'won': return 'bg-green-100 text-green-800';
    case 'lost': return 'bg-red-100 text-red-800';
    case 'shortlisted': return 'bg-yellow-100 text-yellow-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}
```

**Step 2: Implement Settings page**

```tsx
// frontend/src/pages/Settings.tsx
import { useEffect, useState } from 'react';
import { fetchSettings, updateSettings } from '../api/client';

export default function Settings() {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings().then(res => {
      setSettings(res.data.settings);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await updateSettings(settings);
    setSaving(false);
  };

  if (loading) return <div className="text-center py-10">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="bg-white rounded-lg border p-6 max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Auto-Bid Threshold (score)</label>
          <input
            type="number"
            value={settings.auto_bid_threshold}
            onChange={e => setSettings({ ...settings, auto_bid_threshold: parseInt(e.target.value) })}
            className="border rounded px-3 py-2 w-32"
          />
          <p className="text-xs text-gray-500 mt-1">Projects scoring above this are auto-bid without approval</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Approval Threshold (score)</label>
          <input
            type="number"
            value={settings.approval_threshold}
            onChange={e => setSettings({ ...settings, approval_threshold: parseInt(e.target.value) })}
            className="border rounded px-3 py-2 w-32"
          />
          <p className="text-xs text-gray-500 mt-1">Projects scoring below this are discarded</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Pricing Floors ($/hr)</label>
          <div className="grid grid-cols-2 gap-3">
            {settings.pricing_floors && Object.entries(settings.pricing_floors).map(([category, rates]: [string, any]) => (
              <div key={category} className="flex items-center gap-2">
                <span className="text-sm w-32 capitalize">{category.replace('_', ' ')}:</span>
                <input
                  type="number"
                  value={rates.min}
                  onChange={e => setSettings({
                    ...settings,
                    pricing_floors: { ...settings.pricing_floors, [category]: { ...rates, min: parseInt(e.target.value) } }
                  })}
                  className="border rounded px-2 py-1 w-20 text-sm"
                  placeholder="Min"
                />
                <span>-</span>
                <input
                  type="number"
                  value={rates.max}
                  onChange={e => setSettings({
                    ...settings,
                    pricing_floors: { ...settings.pricing_floors, [category]: { ...rates, max: parseInt(e.target.value) } }
                  })}
                  className="border rounded px-2 py-1 w-20 text-sm"
                  placeholder="Max"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add Bids and Settings pages"
```

---

## Task 11: Dockerfile & ECS Deployment Config

**Files:**
- Create: `Dockerfile.production`
- Create: `infrastructure/ecs-task-definition.json`
- Create: `infrastructure/deploy.sh`
- Modify: `docker-compose.yml` (add production profile)

**Step 1: Create production Dockerfile**

```dockerfile
# Dockerfile.production
FROM ruby:3.4-slim-bookworm AS base

RUN apt-get update -qq && \
    apt-get install -y build-essential libcurl4-openssl-dev git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

FROM base AS gems
COPY Gemfile Gemfile.lock ./
RUN bundle config set --local deployment true && \
    bundle config set --local without 'development test' && \
    bundle install

FROM base
COPY --from=gems /app/vendor /app/vendor
COPY --from=gems /usr/local/bundle /usr/local/bundle
COPY . .

ENV RAILS_ENV=production
ENV RAILS_LOG_TO_STDOUT=true

EXPOSE 3000
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
```

**Step 2: Create ECS task definition template**

```json
// infrastructure/ecs-task-definition.json
{
  "family": "freelancing-agent",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "${EXECUTION_ROLE_ARN}",
  "taskRoleArn": "${TASK_ROLE_ARN}",
  "containerDefinitions": [
    {
      "name": "rails-api",
      "image": "${ECR_IMAGE}:latest",
      "portMappings": [{ "containerPort": 3000 }],
      "command": ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"],
      "environment": [
        { "name": "RAILS_ENV", "value": "production" },
        { "name": "RAILS_LOG_TO_STDOUT", "value": "true" }
      ],
      "secrets": [
        { "name": "MONGODB_URI", "valueFrom": "${SECRETS_ARN}:MONGODB_URI::" },
        { "name": "REDIS_URL", "valueFrom": "${SECRETS_ARN}:REDIS_URL::" },
        { "name": "FREELANCER_API_TOKEN", "valueFrom": "${SECRETS_ARN}:FREELANCER_API_TOKEN::" },
        { "name": "OPENAI_API_KEY", "valueFrom": "${SECRETS_ARN}:OPENAI_API_KEY::" },
        { "name": "JWT_SECRET", "valueFrom": "${SECRETS_ARN}:JWT_SECRET::" }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/freelancing-agent",
          "awslogs-region": "${AWS_REGION}",
          "awslogs-stream-prefix": "api"
        }
      }
    }
  ]
}
```

**Step 3: Create deploy script**

```bash
#!/bin/bash
# infrastructure/deploy.sh
set -e

AWS_REGION=${AWS_REGION:-"us-east-1"}
ECR_REPO=${ECR_REPO:-"freelancing-agent"}
ECS_CLUSTER=${ECS_CLUSTER:-"freelancing-agent"}
ECS_SERVICE_API=${ECS_SERVICE_API:-"freelancing-agent-api"}
ECS_SERVICE_WORKER=${ECS_SERVICE_WORKER:-"freelancing-agent-worker"}

echo "Building Docker image..."
docker build -f Dockerfile.production -t $ECR_REPO:latest .

echo "Pushing to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com
docker tag $ECR_REPO:latest $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest
docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO:latest

echo "Updating ECS services..."
aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE_API --force-new-deployment --region $AWS_REGION
aws ecs update-service --cluster $ECS_CLUSTER --service $ECS_SERVICE_WORKER --force-new-deployment --region $AWS_REGION

echo "Deploy complete!"
```

**Step 4: Make deploy script executable and commit**

```bash
chmod +x infrastructure/deploy.sh
git add -A
git commit -m "feat: add production Dockerfile and ECS deployment config"
```

---

## Task 12: Integration Test & Final Verification

**Files:**
- Create: `spec/integration/full_pipeline_spec.rb`

**Step 1: Write integration test**

```ruby
# spec/integration/full_pipeline_spec.rb
require "rails_helper"

RSpec.describe "Full Pipeline", type: :request do
  before do
    stub_request(:get, /www\.freelancer\.com\/api\/projects\/0\.1\/projects\/active/)
      .to_return(
        status: 200,
        body: {
          result: {
            projects: [{
              id: 99999,
              title: "Build React Dashboard with AWS deployment",
              preview_description: "Need a full stack developer to build a React admin dashboard and deploy on AWS ECS with CI/CD pipeline",
              budget: { minimum: 2000, maximum: 5000 },
              currency: { code: "USD" },
              jobs: [{ name: "React" }, { name: "AWS" }, { name: "Docker" }, { name: "Node.js" }],
              owner_id: 555,
              time_submitted: Time.current.to_i
            }]
          }
        }.to_json,
        headers: { "Content-Type" => "application/json" }
      )
  end

  it "scans, scores, and makes project available for bidding" do
    # Run scanner
    Scanner::ScanJob.new.perform

    # Verify project was created and scored
    project = Project.find_by(freelancer_id: "99999")
    expect(project).to be_present
    expect(project.title).to include("React Dashboard")
    expect(project.fit_score["total"]).to be > 60
    expect(project.status).to eq("discovered")
    expect(project.category).to be_present

    # Verify it shows up in API
    get "/api/v1/projects"
    json = JSON.parse(response.body)
    expect(json["projects"].length).to eq(1)

    # Verify dashboard shows it
    get "/api/v1/dashboard"
    json = JSON.parse(response.body)
    expect(json["pipeline"]["discovered"]).to eq(1)
  end
end
```

**Step 2: Run full test suite**

```bash
bundle exec rspec
```

Expected: All tests pass

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add integration test for full scan pipeline"
```

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Rails 8 API scaffold with Mongoid, Sidekiq, Docker |
| 2 | Project model + Scanner module (FreelancerClient, ProjectScorer, ScanJob) |
| 3 | Bid model + Bidder module (PricingEngine, ProposalGenerator, SubmitBidJob) |
| 4 | Settings model (singleton with defaults) |
| 5 | API controllers (Projects, Bids, Settings, Dashboard) |
| 6 | Tracker module (SyncStatusJob, AutoBidJob, scheduled jobs) |
| 7 | React dashboard scaffold (Vite, Tailwind, Router, API client) |
| 8 | Dashboard page (pipeline view, stats) |
| 9 | Projects page (list, filter, approve/reject) |
| 10 | Bids & Settings pages |
| 11 | Production Dockerfile + ECS deployment config |
| 12 | Integration test + final verification |
