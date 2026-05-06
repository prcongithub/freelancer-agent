# Prototype Generation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** When a user clicks "Generate Prototype" on a project detail page, Claude generates a working single-file HTML prototype, uploads it to S3, and lets the user approve it before injecting the live URL into the bid proposal.

**Architecture:** Main Rails API gets a `Prototyper` module (Sidekiq job + Bedrock call + S3 upload) and a `Prototype` model. A new separate `prototype-api` Rails app (port 3001) provides generic CRUD/auth/file-upload endpoints namespaced by `proto_id`. Frontend gets a PrototypePanel component with polling.

**Tech Stack:** Rails 8 API, Mongoid 9, Sidekiq, AWS Bedrock (Claude Haiku), aws-sdk-s3, bcrypt, jwt gem, Rack CORS, React 19 + TypeScript, Tailwind + Alpine.js (in generated HTML).

---

## Context: Codebase Layout

```
freelancing-agent/
  app/
    models/project.rb          ← add has-one-style link to Prototype
    modules/
      analyzer/                ← reference for Bedrock call pattern
      bidder/proposal_generator.rb  ← Task 4 modifies this
      prototyper/              ← Task 2 creates this
    controllers/api/v1/        ← Task 3 adds prototypes_controller.rb
  config/routes.rb             ← Task 3 modifies
  Gemfile                      ← Task 1 adds aws-sdk-s3, bcrypt
  docker-compose.yml           ← Task 10 adds prototype-api service
  .env                         ← Task 10 adds new vars
  prototype-api/               ← Tasks 6-10 create this entire directory
  frontend/src/
    types/api.ts               ← Task 11 adds Prototype type
    api/client.ts              ← Task 11 adds prototype API calls
    pages/ProjectDetail.tsx    ← Task 12 adds PrototypePanel
```

**Key patterns to follow:**
- Bedrock calls: see `app/modules/analyzer/project_analyzer.rb` — use `Aws::BedrockRuntime::Client.new` with `ENV.fetch("AWS_BEDROCK_*")` credentials
- Sidekiq jobs: include `Sidekiq::Job`, `sidekiq_options queue: :default, retry: 2`
- MongoDB raw driver access: `Mongoid.client(:default).collections`

---

## Task 1: Add gems + env vars to main app

**Files:**
- Modify: `Gemfile`
- Modify: `.env`

**Step 1: Add aws-sdk-s3 and bcrypt to Gemfile**

In `Gemfile`, add after the existing `gem "aws-sdk-bedrockruntime"` line:

```ruby
gem "aws-sdk-s3"
gem "bcrypt", "~> 3.1.7"
```

(`jwt` gem is already in the Gemfile.)

**Step 2: Rebuild the Docker image**

```bash
docker compose build api sidekiq
```

Expected: build completes, `aws-sdk-s3` and `bcrypt` appear in bundle output.

**Step 3: Add env vars to .env**

Append to `.env`:

```
# Prototype generation
S3_PROTOTYPE_BUCKET=freelancing-prototypes
PROTO_API_PUBLIC_URL=http://localhost:3001
CLOUDFRONT_PROTOTYPE_URL=
```

Leave `CLOUDFRONT_PROTOTYPE_URL` blank for now — the generator will fall back to the S3 URL.

**Step 4: Create the S3 bucket**

```bash
aws s3 mb s3://freelancing-prototypes --region us-east-1
aws s3api put-bucket-cors --bucket freelancing-prototypes --cors-configuration '{
  "CORSRules": [{
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3000
  }]
}'
```

**Step 5: Commit**

```bash
git add Gemfile Gemfile.lock .env
git commit -m "chore: add aws-sdk-s3, bcrypt gems and prototype env vars"
```

---

## Task 2: Prototype model

**Files:**
- Create: `app/models/prototype.rb`
- Create: `spec/models/prototype_spec.rb`

**Step 1: Write the failing test**

Create `spec/models/prototype_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe Prototype, type: :model do
  it "generates a proto_id before create" do
    p = Prototype.new(project_id: "abc123", status: "generating")
    p.save!
    expect(p.proto_id).to match(/\A[a-z0-9]{6}\z/)
  end

  it "validates status inclusion" do
    p = Prototype.new(project_id: "abc123", status: "invalid", proto_id: "x1y2z3")
    expect(p).not_to be_valid
  end

  it "is invalid without project_id" do
    p = Prototype.new(status: "generating", proto_id: "x1y2z3")
    expect(p).not_to be_valid
  end
end
```

**Step 2: Run test to confirm it fails**

```bash
docker compose exec api bundle exec rspec spec/models/prototype_spec.rb
```

Expected: `NameError: uninitialized constant Prototype`

**Step 3: Create the model**

Create `app/models/prototype.rb`:

```ruby
class Prototype
  include Mongoid::Document
  include Mongoid::Timestamps

  STATUSES = %w[generating ready failed approved rejected].freeze

  field :project_id,   type: String
  field :proto_id,     type: String
  field :status,       type: String, default: "generating"
  field :public_url,   type: String
  field :s3_key,       type: String
  field :approved,     type: Boolean, default: false
  field :generated_at, type: Time
  field :approved_at,  type: Time

  validates :project_id, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :proto_id, presence: true, uniqueness: true

  index({ project_id: 1 })
  index({ proto_id: 1 }, { unique: true })

  before_validation :assign_proto_id, on: :create

  private

  def assign_proto_id
    self.proto_id ||= SecureRandom.alphanumeric(6).downcase
  end
end
```

**Step 4: Run test to confirm it passes**

```bash
docker compose exec api bundle exec rspec spec/models/prototype_spec.rb
```

Expected: `3 examples, 0 failures`

**Step 5: Commit**

```bash
git add app/models/prototype.rb spec/models/prototype_spec.rb
git commit -m "feat: add Prototype model with proto_id generation"
```

---

## Task 3: PrototypeGenerator service + PrototypeGeneratorJob

**Files:**
- Create: `app/modules/prototyper/prototype_generator.rb`
- Create: `app/modules/prototyper/prototype_generator_job.rb`
- Create: `spec/modules/prototyper/prototype_generator_spec.rb`

**Step 1: Write the failing test**

Create `spec/modules/prototyper/prototype_generator_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe Prototyper::PrototypeGenerator do
  let(:project_data) do
    {
      title: "Task Manager App",
      description: "A simple task management app with user auth",
      category: "fullstack",
      skills_required: ["React", "Node.js"],
      analysis: { "scope" => "CRUD app for tasks", "ai_advantage" => "Fast delivery" },
      proto_id: "abc123",
      proto_api_url: "http://localhost:3001"
    }
  end

  describe "#build_prompt" do
    it "includes proto_id in API URL references" do
      generator = described_class.new
      prompt = generator.send(:build_prompt, project_data)
      expect(prompt).to include("abc123")
      expect(prompt).to include("http://localhost:3001")
    end

    it "includes category-specific instruction for fullstack" do
      generator = described_class.new
      prompt = generator.send(:build_prompt, project_data)
      expect(prompt).to include("full UI")
    end

    it "includes ai_automation instruction for ai_automation category" do
      generator = described_class.new
      data = project_data.merge(category: "ai_automation")
      prompt = generator.send(:build_prompt, data)
      expect(prompt).to include("chat interface")
    end
  end

  describe "#valid_html?" do
    it "returns true for valid HTML" do
      generator = described_class.new
      expect(generator.send(:valid_html?, "<html><body>hi</body></html>")).to be true
    end

    it "returns false for truncated response" do
      generator = described_class.new
      expect(generator.send(:valid_html?, "<html><body>truncated")).to be false
    end
  end
end
```

**Step 2: Run test to confirm it fails**

```bash
docker compose exec api bundle exec rspec spec/modules/prototyper/prototype_generator_spec.rb
```

Expected: `NameError: uninitialized constant Prototyper`

**Step 3: Create PrototypeGenerator**

Create `app/modules/prototyper/prototype_generator.rb`:

```ruby
module Prototyper
  class PrototypeGenerator
    DEFAULT_MODEL = "global.anthropic.claude-haiku-4-5-20251001-v1:0".freeze

    CATEGORY_HINTS = {
      "frontend"      => "Build a full UI with working navigation, multiple pages/views, and all data operations wired to the API.",
      "fullstack"     => "Build a full UI with working navigation, multiple pages/views, and all data operations wired to the API.",
      "ai_automation" => "Build a chat interface or workflow UI. Simulate streaming AI responses by fetching from /:proto_id/messages and animating the text display.",
      "backend"       => "Build a clean API Explorer UI (Swagger-style) listing all available endpoints with example request/response panels. Include a live 'Try it' button that calls the prototype API.",
      "aws_devops"    => "Build an infrastructure dashboard UI showing mock AWS resource statuses, cost metrics, and deployment pipeline stages. Data comes from the prototype API."
    }.freeze

    def generate(project_data)
      prompt = build_prompt(project_data)
      html   = call_bedrock(prompt)

      unless valid_html?(html)
        # Retry with simpler prompt
        html = call_bedrock(build_simple_prompt(project_data))
        raise "Malformed HTML after retry" unless valid_html?(html)
      end

      html
    end

    def upload_to_s3(html, proto_id)
      bucket  = ENV.fetch("S3_PROTOTYPE_BUCKET", "freelancing-prototypes")
      key     = "prototypes/#{proto_id}/index.html"
      region  = ENV.fetch("AWS_BEDROCK_REGION", "us-east-1")

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

    def build_prompt(project_data)
      proto_id     = project_data[:proto_id]
      proto_url    = project_data[:proto_api_url]
      category     = project_data[:category] || "fullstack"
      scope        = project_data.dig(:analysis, "scope") || project_data.dig(:analysis, :scope) || ""
      skills       = (project_data[:skills_required] || []).join(", ")
      category_hint = CATEGORY_HINTS[category] || CATEGORY_HINTS["fullstack"]

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
        Available endpoints (use fetch() to call these):
          GET/POST  /#{proto_id}/:collection          (list/create documents)
          GET/PUT/DELETE /#{proto_id}/:collection/:id (get/update/delete)
          POST /#{proto_id}/auth/register             ({ email, password } → { token })
          POST /#{proto_id}/auth/login                ({ email, password } → { token })
          GET  /#{proto_id}/auth/me                   (Bearer token header → user)
          POST /#{proto_id}/uploads                   (multipart → { url })

        REQUIREMENTS:
        - Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
        - Use Alpine.js via CDN: <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
        - On first load, seed 3-5 realistic sample documents via POST (use localStorage flag "seeded_#{proto_id}" to prevent re-seeding)
        - Look like a real production app — professional design, not a wireframe
        - Mobile-responsive layout
        - Include a subtle watermark in the bottom-right corner: "⚡ Prototype by Prashant C."
        - Handle API errors gracefully (show a user-friendly message)
        - #{category_hint}

        Return the complete HTML file starting with <!DOCTYPE html>.
      PROMPT
    end

    def build_simple_prompt(project_data)
      proto_id  = project_data[:proto_id]
      proto_url = project_data[:proto_api_url]

      <<~PROMPT
        Build a simple single-page CRUD app prototype as a self-contained HTML file.
        Use Tailwind CDN and Alpine.js CDN.
        API base: #{proto_url}/#{proto_id}
        App name: #{project_data[:title]}
        Show a list of items fetched from GET /#{proto_id}/items, with an add form and delete buttons.
        Include a watermark "⚡ Prototype by Prashant C." in the bottom-right.
        Return ONLY the HTML file starting with <!DOCTYPE html>.
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
        inference_config: { max_tokens: 8000, temperature: 0.5 }
      )

      text = response.output.message.content.first.text
      # Strip markdown code fences if Claude wraps in them
      text.gsub(/\A```(?:html)?\n?/, "").gsub(/\n?```\z/, "").strip
    end

    def valid_html?(html)
      html.to_s.include?("</html>")
    end
  end
end
```

**Step 4: Create PrototypeGeneratorJob**

Create `app/modules/prototyper/prototype_generator_job.rb`:

```ruby
module Prototyper
  class PrototypeGeneratorJob
    include Sidekiq::Job
    sidekiq_options queue: :default, retry: 2

    def perform(prototype_id)
      prototype = Prototype.find(prototype_id)
      project   = Project.find(prototype.project_id)

      generator = PrototypeGenerator.new

      project_data = {
        title:           project.title,
        description:     project.description,
        category:        project.category,
        skills_required: project.skills_required,
        analysis:        project.analysis,
        proto_id:        prototype.proto_id,
        proto_api_url:   ENV.fetch("PROTO_API_PUBLIC_URL", "http://localhost:3001")
      }

      html       = generator.generate(project_data)
      public_url = generator.upload_to_s3(html, prototype.proto_id)

      prototype.update!(
        status:       "ready",
        public_url:   public_url,
        s3_key:       "prototypes/#{prototype.proto_id}/index.html",
        generated_at: Time.current
      )
    rescue => e
      Rails.logger.error("PrototypeGeneratorJob failed for #{prototype_id}: #{e.class}: #{e.message}")
      Prototype.where(id: prototype_id).update_all("$set" => { status: "failed" })
      raise
    end
  end
end
```

**Step 5: Run tests**

```bash
docker compose exec api bundle exec rspec spec/modules/prototyper/prototype_generator_spec.rb
```

Expected: `5 examples, 0 failures`

**Step 6: Commit**

```bash
git add app/modules/prototyper/ spec/modules/prototyper/
git commit -m "feat: add PrototypeGenerator service and PrototypeGeneratorJob"
```

---

## Task 4: PrototypesController + routes (main app)

**Files:**
- Create: `app/controllers/api/v1/prototypes_controller.rb`
- Modify: `config/routes.rb`
- Create: `spec/requests/api/v1/prototypes_spec.rb`

**Step 1: Write the failing request spec**

Create `spec/requests/api/v1/prototypes_spec.rb`:

```ruby
require 'rails_helper'

RSpec.describe "Api::V1::Prototypes", type: :request do
  let!(:project) { Project.create!(freelancer_id: "111", title: "Test", status: "discovered") }

  describe "POST /api/v1/projects/:id/prototype" do
    it "creates a Prototype record and returns 202" do
      expect(Prototyper::PrototypeGeneratorJob).to receive(:perform_async)
      post "/api/v1/projects/#{project.id}/prototype"
      expect(response).to have_http_status(:accepted)
      body = JSON.parse(response.body)
      expect(body["prototype"]["status"]).to eq("generating")
      expect(body["prototype"]["proto_id"]).to match(/\A[a-z0-9]{6}\z/)
    end

    it "returns the existing prototype if one is already generating" do
      proto = Prototype.create!(project_id: project.id.to_s, status: "generating")
      post "/api/v1/projects/#{project.id}/prototype"
      expect(response).to have_http_status(:accepted)
      expect(JSON.parse(response.body)["prototype"]["id"]).to eq(proto.id.to_s)
    end
  end

  describe "GET /api/v1/projects/:id/prototype" do
    it "returns 404 when no prototype exists" do
      get "/api/v1/projects/#{project.id}/prototype"
      expect(response).to have_http_status(:not_found)
    end

    it "returns the prototype when it exists" do
      Prototype.create!(project_id: project.id.to_s, status: "ready", public_url: "https://example.com")
      get "/api/v1/projects/#{project.id}/prototype"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["prototype"]["status"]).to eq("ready")
    end
  end

  describe "POST /api/v1/prototypes/:id/approve" do
    it "sets approved=true and status=approved" do
      proto = Prototype.create!(project_id: project.id.to_s, status: "ready")
      post "/api/v1/prototypes/#{proto.id}/approve"
      expect(response).to have_http_status(:ok)
      proto.reload
      expect(proto.approved).to be true
      expect(proto.status).to eq("approved")
    end
  end

  describe "POST /api/v1/prototypes/:id/reject" do
    it "sets status=rejected" do
      proto = Prototype.create!(project_id: project.id.to_s, status: "ready")
      post "/api/v1/prototypes/#{proto.id}/reject"
      expect(response).to have_http_status(:ok)
      expect(proto.reload.status).to eq("rejected")
    end
  end
end
```

**Step 2: Run test to confirm it fails**

```bash
docker compose exec api bundle exec rspec spec/requests/api/v1/prototypes_spec.rb
```

Expected: routing errors / `ActionController::RoutingError`

**Step 3: Add routes**

Modify `config/routes.rb`. Add inside `namespace :v1`:

```ruby
resources :projects, only: [:index, :show] do
  member do
    post :approve_bid
    post :reject
    post :analyze
    post :prototype          # ← add this
    get  :prototype          # ← add this
  end
end

resources :prototypes, only: [] do
  member do
    post :approve
    post :reject
  end
end
```

**Step 4: Create PrototypesController**

Create `app/controllers/api/v1/prototypes_controller.rb`:

```ruby
module Api
  module V1
    class PrototypesController < ApplicationController
      # POST /api/v1/projects/:id/prototype
      def create
        project = Project.find(params[:id])

        existing = Prototype.where(project_id: project.id.to_s)
                            .not_in(status: ["failed", "rejected"])
                            .first
        if existing
          render json: { prototype: serialize(existing) }, status: :accepted
          return
        end

        prototype = Prototype.create!(project_id: project.id.to_s, status: "generating")
        Prototyper::PrototypeGeneratorJob.perform_async(prototype.id.to_s)
        render json: { prototype: serialize(prototype) }, status: :accepted
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Project not found" }, status: :not_found
      end

      # GET /api/v1/projects/:id/prototype
      def show
        project   = Project.find(params[:id])
        prototype = Prototype.where(project_id: project.id.to_s).order(created_at: :desc).first

        if prototype.nil?
          render json: { error: "No prototype" }, status: :not_found
          return
        end

        render json: { prototype: serialize(prototype) }
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Project not found" }, status: :not_found
      end

      # POST /api/v1/prototypes/:id/approve
      def approve
        prototype = Prototype.find(params[:id])
        prototype.update!(status: "approved", approved: true, approved_at: Time.current)
        render json: { prototype: serialize(prototype) }
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Prototype not found" }, status: :not_found
      end

      # POST /api/v1/prototypes/:id/reject
      def reject
        prototype = Prototype.find(params[:id])
        prototype.update!(status: "rejected", approved: false)
        render json: { prototype: serialize(prototype) }
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Prototype not found" }, status: :not_found
      end

      private

      def serialize(prototype)
        {
          id:           prototype.id.to_s,
          project_id:   prototype.project_id,
          proto_id:     prototype.proto_id,
          status:       prototype.status,
          public_url:   prototype.public_url,
          approved:     prototype.approved,
          generated_at: prototype.generated_at,
          approved_at:  prototype.approved_at,
          created_at:   prototype.created_at
        }
      end
    end
  end
end
```

**Step 5: Run tests**

```bash
docker compose exec api bundle exec rspec spec/requests/api/v1/prototypes_spec.rb
```

Expected: `6 examples, 0 failures`

**Step 6: Commit**

```bash
git add app/controllers/api/v1/prototypes_controller.rb config/routes.rb spec/requests/api/v1/prototypes_spec.rb
git commit -m "feat: add PrototypesController and prototype routes"
```

---

## Task 5: Update ProposalGenerator to append prototype URL

**Files:**
- Modify: `app/modules/bidder/proposal_generator.rb`

**Step 1: Locate the generate method**

Open `app/modules/bidder/proposal_generator.rb`. The `generate` method takes a `project` hash and returns a string.

**Step 2: Add prototype URL injection**

Add a `prototype_url` key to the project data passed into the generator and append it to the proposal. Modify `build_prompt` to accept an optional prototype URL, and modify `generate` to append it after the Bedrock call:

In `generate`:
```ruby
def generate(project)
  prompt   = build_prompt(project)
  proposal = call_bedrock(SYSTEM_PROMPT, prompt)

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
```

**Step 3: Update SubmitBidJob to pass prototype_url**

Open `app/modules/bidder/submit_bid_job.rb`. In the `perform` method, find where `project_data` is built and add:

```ruby
# Find approved prototype for this project
approved_prototype = Prototype.where(project_id: project.id.to_s, status: "approved").first

project_data = {
  title:           project.title,
  description:     project.description,
  category:        project.category,
  budget_range:    project.budget_range&.transform_keys(&:to_sym) || {},
  skills_required: project.skills_required,
  fit_score:       project.fit_score&.transform_keys(&:to_sym) || {},
  analysis:        project.analysis,
  prototype_url:   approved_prototype&.public_url
}
```

**Step 4: Restart and test manually**

```bash
docker compose restart api sidekiq
```

Approve a prototype in the UI, then approve a bid — verify the bid proposal text includes the prototype URL.

**Step 5: Commit**

```bash
git add app/modules/bidder/proposal_generator.rb app/modules/bidder/submit_bid_job.rb
git commit -m "feat: inject approved prototype URL into bid proposal"
```

---

## Task 6: Scaffold prototype-api Rails app

**Files:**
- Create: `prototype-api/` (entire directory)

**Step 1: Scaffold minimal Rails API app**

```bash
cd /home/prashant/data/PRC/startup_ideas/freelancing-agent
rails new prototype-api --api --skip-git --skip-test --skip-action-mailer \
  --skip-action-mailbox --skip-action-text --skip-active-record \
  --skip-active-storage --skip-action-cable --skip-bootsnap \
  --skip-kamal --skip-thruster
```

**Step 2: Replace prototype-api/Gemfile entirely**

```ruby
source "https://rubygems.org"
ruby File.read(".ruby-version").strip rescue "3.4.0"

gem "rails", "~> 8.1.1"
gem "puma", ">= 5.0"
gem "rack-cors"

# MongoDB
gem "mongoid", "~> 9.0"

# Auth
gem "jwt", "~> 2.8"
gem "bcrypt", "~> 3.1.7"

# AWS S3 (file uploads)
gem "aws-sdk-s3"

# Env
gem "dotenv-rails"
```

**Step 3: Install gems**

```bash
cd prototype-api && bundle install
```

**Step 4: Create .ruby-version**

```bash
echo "3.4.9" > prototype-api/.ruby-version
```

**Step 5: Generate Mongoid config**

```bash
cd prototype-api && bundle exec rails g mongoid:config
```

**Step 6: Replace prototype-api/config/mongoid.yml**

```yaml
development:
  clients:
    default:
      uri: <%= ENV.fetch('MONGODB_URI', 'mongodb://localhost:27017/freelancing_prototypes') %>
      options:
        server_selection_timeout: 5
production:
  clients:
    default:
      uri: <%= ENV.fetch('MONGODB_URI') %>
```

**Step 7: Create prototype-api/.env**

```
MONGODB_URI=mongodb://mongo1:27017,mongo2:27017,mongo3:27017/freelancing_prototypes?replicaSet=my-mongo-set
PROTO_JWT_SECRET=change_me_to_a_64_char_random_string
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<same as main app>
AWS_SECRET_ACCESS_KEY=<same as main app>
S3_PROTOTYPE_BUCKET=freelancing-prototypes
```

**Step 8: Commit**

```bash
cd ..
git add prototype-api/
git commit -m "chore: scaffold prototype-api Rails app"
```

---

## Task 7: prototype-api CRUD controller

**Files:**
- Create: `prototype-api/app/controllers/crud_controller.rb`
- Modify: `prototype-api/config/routes.rb`
- Create: `prototype-api/app/controllers/application_controller.rb`

**Step 1: Create ApplicationController**

Replace `prototype-api/app/controllers/application_controller.rb`:

```ruby
class ApplicationController < ActionController::API
  private

  def collection_name(proto_id, name)
    # Sanitize: only alphanumeric and underscores, max 40 chars
    safe = name.to_s.gsub(/[^a-zA-Z0-9_]/, "").first(40)
    raise ActionController::BadRequest, "Invalid collection name" if safe.blank?
    "#{proto_id}_#{safe}"
  end

  def mongo_collection(col_name)
    Mongoid.client(:default)[col_name]
  end

  def object_id(id)
    BSON::ObjectId(id)
  rescue BSON::Error::InvalidObjectId
    nil
  end
end
```

**Step 2: Create CrudController**

Create `prototype-api/app/controllers/crud_controller.rb`:

```ruby
class CrudController < ApplicationController
  before_action :set_collection

  # GET /:proto_id/:collection
  def index
    docs = @col.find.limit(200).to_a.map { |d| serialize(d) }
    render json: docs
  end

  # POST /:proto_id/:collection
  def create
    doc = params.except(:proto_id, :collection, :controller, :action, :format)
                .permit!.to_h
    doc["_id"]        = BSON::ObjectId.new
    doc["created_at"] = Time.current.utc
    doc["updated_at"] = Time.current.utc
    @col.insert_one(doc)
    render json: serialize(doc), status: :created
  end

  # GET /:proto_id/:collection/:id
  def show
    doc = find_doc!
    render json: serialize(doc)
  end

  # PUT /:proto_id/:collection/:id
  def update
    find_doc!
    updates = params.except(:proto_id, :collection, :id, :controller, :action, :format)
                    .permit!.to_h
    updates["updated_at"] = Time.current.utc
    @col.find(_id: object_id(params[:id])).update_one("$set" => updates)
    render json: serialize(@col.find(_id: object_id(params[:id])).first)
  end

  # PATCH /:proto_id/:collection/:id — same as update
  alias_method :partial_update, :update

  # DELETE /:proto_id/:collection/:id
  def destroy
    find_doc!
    @col.find(_id: object_id(params[:id])).delete_one
    head :no_content
  end

  private

  def set_collection
    col_name = collection_name(params[:proto_id], params[:collection])
    @col     = mongo_collection(col_name)
  rescue ActionController::BadRequest => e
    render json: { error: e.message }, status: :bad_request
  end

  def find_doc!
    oid = object_id(params[:id])
    render json: { error: "Invalid id" }, status: :bad_request and return unless oid
    doc = @col.find(_id: oid).first
    render json: { error: "Not found" }, status: :not_found and return unless doc
    doc
  end

  def serialize(doc)
    doc.transform_keys(&:to_s).tap { |d| d["id"] = d.delete("_id").to_s }
  end
end
```

**Step 3: Create NamespaceController (wipe)**

Create `prototype-api/app/controllers/namespace_controller.rb`:

```ruby
class NamespaceController < ApplicationController
  # DELETE /:proto_id  — wipe all data for a prototype namespace
  def destroy
    proto_id = params[:proto_id]
    Mongoid.client(:default).collections.each do |col|
      col.drop if col.name.start_with?("#{proto_id}_")
    end
    head :no_content
  end
end
```

**Step 4: Set up routes**

Replace `prototype-api/config/routes.rb`:

```ruby
Rails.application.routes.draw do
  scope "/:proto_id" do
    # Auth
    scope "/auth" do
      post "/register", to: "auth#register"
      post "/login",    to: "auth#login"
      get  "/me",       to: "auth#me"
    end

    # File uploads
    post "/uploads", to: "uploads#create"

    # Generic CRUD
    get    "/:collection",     to: "crud#index"
    post   "/:collection",     to: "crud#create"
    get    "/:collection/:id", to: "crud#show"
    put    "/:collection/:id", to: "crud#update"
    patch  "/:collection/:id", to: "crud#partial_update"
    delete "/:collection/:id", to: "crud#destroy"

    # Namespace wipe
    delete "/", to: "namespace#destroy"
  end

  get "/health", to: proc { [200, {}, ["ok"]] }
end
```

**Step 5: Add CORS**

Replace `prototype-api/config/initializers/cors.rb` (create if not exists):

```ruby
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins "*"
    resource "*",
      headers: :any,
      methods: [:get, :post, :put, :patch, :delete, :options, :head],
      expose:  ["Authorization"]
  end
end
```

**Step 6: Test manually**

```bash
cd prototype-api && bundle exec rails server -p 3001 &
curl http://localhost:3001/health
# Expected: ok
curl -X POST http://localhost:3001/abc123/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Buy milk","done":false}'
# Expected: {"id":"...","title":"Buy milk","done":false,"created_at":"..."}
curl http://localhost:3001/abc123/tasks
# Expected: [{"id":"...","title":"Buy milk","done":false,...}]
```

**Step 7: Commit**

```bash
cd ..
git add prototype-api/app/controllers/ prototype-api/config/routes.rb prototype-api/config/initializers/
git commit -m "feat: add prototype-api CRUD and namespace controllers"
```

---

## Task 8: prototype-api Auth controller

**Files:**
- Create: `prototype-api/app/controllers/auth_controller.rb`

**Step 1: Create AuthController**

Create `prototype-api/app/controllers/auth_controller.rb`:

```ruby
class AuthController < ApplicationController
  before_action :authenticate!, only: [:me]

  # POST /:proto_id/auth/register
  def register
    col   = mongo_collection("#{params[:proto_id]}_users")
    email = params[:email].to_s.downcase.strip

    render json: { error: "Email required" }, status: :bad_request and return if email.blank?
    render json: { error: "Password required" }, status: :bad_request and return if params[:password].blank?
    render json: { error: "Email already taken" }, status: :conflict and return if col.find(email: email).first

    hashed = BCrypt::Password.create(params[:password])
    user   = { "_id" => BSON::ObjectId.new, "email" => email, "password_digest" => hashed,
               "created_at" => Time.current.utc }
    col.insert_one(user)

    render json: { token: encode_token(params[:proto_id], user["_id"].to_s, email),
                   user: { id: user["_id"].to_s, email: email } }, status: :created
  end

  # POST /:proto_id/auth/login
  def login
    col   = mongo_collection("#{params[:proto_id]}_users")
    email = params[:email].to_s.downcase.strip
    user  = col.find(email: email).first

    if user && BCrypt::Password.new(user["password_digest"]) == params[:password]
      render json: { token: encode_token(params[:proto_id], user["_id"].to_s, email),
                     user: { id: user["_id"].to_s, email: email } }
    else
      render json: { error: "Invalid credentials" }, status: :unauthorized
    end
  end

  # GET /:proto_id/auth/me
  def me
    render json: { user: @current_user }
  end

  private

  def encode_token(proto_id, user_id, email)
    secret = ENV.fetch("PROTO_JWT_SECRET", "fallback_secret")
    JWT.encode({ proto_id: proto_id, user_id: user_id, email: email, exp: 30.days.from_now.to_i },
               secret, "HS256")
  end

  def authenticate!
    header = request.headers["Authorization"]
    token  = header&.split(" ")&.last
    render json: { error: "Unauthorized" }, status: :unauthorized and return unless token

    secret  = ENV.fetch("PROTO_JWT_SECRET", "fallback_secret")
    payload = JWT.decode(token, secret, true, algorithms: ["HS256"]).first

    unless payload["proto_id"] == params[:proto_id]
      render json: { error: "Token proto_id mismatch" }, status: :unauthorized and return
    end

    col   = mongo_collection("#{params[:proto_id]}_users")
    @current_user = col.find("_id" => BSON::ObjectId(payload["user_id"])).first
    render json: { error: "User not found" }, status: :unauthorized unless @current_user
  rescue JWT::DecodeError
    render json: { error: "Invalid token" }, status: :unauthorized
  end
end
```

**Step 2: Test manually**

```bash
curl -X POST http://localhost:3001/abc123/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}'
# Expected: {"token":"...","user":{"id":"...","email":"test@example.com"}}

TOKEN=$(curl -s -X POST http://localhost:3001/abc123/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}' | jq -r .token)

curl http://localhost:3001/abc123/auth/me -H "Authorization: Bearer $TOKEN"
# Expected: {"user":{"_id":"...","email":"test@example.com"}}
```

**Step 3: Commit**

```bash
git add prototype-api/app/controllers/auth_controller.rb
git commit -m "feat: add prototype-api auth controller (register/login/me)"
```

---

## Task 9: prototype-api Uploads controller

**Files:**
- Create: `prototype-api/app/controllers/uploads_controller.rb`

**Step 1: Create UploadsController**

Create `prototype-api/app/controllers/uploads_controller.rb`:

```ruby
class UploadsController < ApplicationController
  # POST /:proto_id/uploads
  def create
    file     = params[:file]
    render json: { error: "No file provided" }, status: :bad_request and return unless file

    proto_id  = params[:proto_id]
    ext       = File.extname(file.original_filename).downcase
    key       = "proto-uploads/#{proto_id}/#{SecureRandom.uuid}#{ext}"
    bucket    = ENV.fetch("S3_PROTOTYPE_BUCKET", "freelancing-prototypes")
    region    = ENV.fetch("AWS_REGION", "us-east-1")

    s3 = Aws::S3::Client.new(
      region:            region,
      access_key_id:     ENV.fetch("AWS_ACCESS_KEY_ID"),
      secret_access_key: ENV.fetch("AWS_SECRET_ACCESS_KEY")
    )

    s3.put_object(
      bucket:       bucket,
      key:          key,
      body:         file.read,
      content_type: file.content_type,
      acl:          "public-read"
    )

    url = "https://#{bucket}.s3.#{region}.amazonaws.com/#{key}"
    render json: { url: url }, status: :created
  rescue Aws::S3::Errors::ServiceError => e
    Rails.logger.error("Upload failed: #{e.message}")
    render json: { error: "Upload failed" }, status: :internal_server_error
  end
end
```

**Step 2: Test manually**

```bash
curl -X POST http://localhost:3001/abc123/uploads \
  -F "file=@/path/to/test-image.jpg"
# Expected: {"url":"https://freelancing-prototypes.s3.us-east-1.amazonaws.com/proto-uploads/abc123/uuid.jpg"}
```

**Step 3: Commit**

```bash
git add prototype-api/app/controllers/uploads_controller.rb
git commit -m "feat: add prototype-api uploads controller (S3)"
```

---

## Task 10: Docker Compose + prototype-api Dockerfile

**Files:**
- Create: `prototype-api/Dockerfile`
- Modify: `docker-compose.yml`

**Step 1: Create prototype-api/Dockerfile**

```dockerfile
FROM ruby:3.4.9-slim

RUN apt-get update -qq && apt-get install -y build-essential git && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3

COPY . .

EXPOSE 3001
CMD ["rails", "server", "-b", "0.0.0.0", "-p", "3001"]
```

**Step 2: Add prototype-api service to docker-compose.yml**

Add after the `sidekiq` service, before the `networks` section:

```yaml
  prototype-api:
    build: ./prototype-api
    command: rails server -b 0.0.0.0 -p 3001
    ports:
      - "3001:3001"
    env_file: ./prototype-api/.env
    networks:
      - default
      - kong-net
    volumes:
      - ./prototype-api:/app
```

**Step 3: Add PROTO_API_PUBLIC_URL to main .env**

```
PROTO_API_PUBLIC_URL=http://localhost:3001
```

**Step 4: Build and start**

```bash
docker compose build prototype-api
docker compose up -d prototype-api
curl http://localhost:3001/health
```

Expected: `ok`

**Step 5: Restart main services to pick up new env var**

```bash
docker compose up -d api sidekiq
```

**Step 6: Commit**

```bash
git add prototype-api/Dockerfile docker-compose.yml
git commit -m "chore: add prototype-api to Docker Compose"
```

---

## Task 11: Frontend TypeScript types + API client

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/api/client.ts`

**Step 1: Add Prototype type to api.ts**

In `frontend/src/types/api.ts`, add at the end:

```typescript
export interface Prototype {
  id: string;
  project_id: string;
  proto_id: string;
  status: 'generating' | 'ready' | 'failed' | 'approved' | 'rejected';
  public_url?: string;
  approved: boolean;
  generated_at?: string;
  approved_at?: string;
  created_at?: string;
}
```

**Step 2: Add prototype API calls to client.ts**

In `frontend/src/api/client.ts`, add after `analyzeProject`:

```typescript
export const generatePrototype = (projectId: string) =>
  api.post<{ prototype: Prototype }>(`/projects/${projectId}/prototype`);

export const fetchPrototype = (projectId: string) =>
  api.get<{ prototype: Prototype }>(`/projects/${projectId}/prototype`);

export const approvePrototype = (prototypeId: string) =>
  api.post<{ prototype: Prototype }>(`/prototypes/${prototypeId}/approve`);

export const rejectPrototype = (prototypeId: string) =>
  api.post<{ prototype: Prototype }>(`/prototypes/${prototypeId}/reject`);
```

Also update the import at the top to include `Prototype`:

```typescript
import type { Project, Bid, DashboardData, Settings, Prototype } from '../types/api';
```

**Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
cd ..
git add frontend/src/types/api.ts frontend/src/api/client.ts
git commit -m "feat: add Prototype type and prototype API client calls"
```

---

## Task 12: Frontend PrototypePanel component

**Files:**
- Modify: `frontend/src/pages/ProjectDetail.tsx`

**Step 1: Add imports**

At the top of `ProjectDetail.tsx`, add to the import from `../api/client`:

```typescript
import { fetchProject, approveBid, rejectProject, analyzeProject,
         generatePrototype, fetchPrototype, approvePrototype, rejectPrototype } from '../api/client';
import type { Project, ProjectAnalysis, BidRecommendation, BidStats, Prototype } from '../types/api';
```

**Step 2: Add prototype state to the component**

Inside `ProjectDetail()` function, after the existing state declarations:

```typescript
const [prototype, setPrototype] = useState<Prototype | null>(null);
const [protoLoading, setProtoLoading] = useState(false);
const [protoPollInterval, setProtoPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);
```

**Step 3: Fetch prototype on mount**

Inside the existing `useEffect` that fetches the project, after `setProject(res.data.project)`:

```typescript
// Also fetch prototype status
fetchPrototype(id).then(r => setPrototype(r.data.prototype)).catch(() => {});
```

**Step 4: Add prototype handlers**

After `handleAnalyze`, add:

```typescript
const handleGeneratePrototype = async () => {
  if (!project) return;
  setProtoLoading(true);
  try {
    const res = await generatePrototype(project.id);
    setPrototype(res.data.prototype);
    // Poll until ready/failed
    const interval = setInterval(async () => {
      const r = await fetchPrototype(project.id);
      const p = r.data.prototype;
      setPrototype(p);
      if (p.status !== 'generating') {
        clearInterval(interval);
        setProtoPollInterval(null);
        setProtoLoading(false);
      }
    }, 3000);
    setProtoPollInterval(interval);
  } catch {
    setProtoLoading(false);
    setActionError('Failed to start prototype generation.');
  }
};

const handleApprovePrototype = async () => {
  if (!prototype) return;
  const res = await approvePrototype(prototype.id);
  setPrototype(res.data.prototype);
};

const handleRejectPrototype = async () => {
  if (!prototype) return;
  const res = await rejectPrototype(prototype.id);
  setPrototype(res.data.prototype);
};
```

**Step 5: Clean up interval on unmount**

Add a cleanup `useEffect` after the fetch effect:

```typescript
useEffect(() => {
  return () => { if (protoPollInterval) clearInterval(protoPollInterval); };
}, [protoPollInterval]);
```

**Step 6: Add PrototypePanel to the JSX**

In the return JSX, add after the `{/* Analysis */}` block and before `{/* Actions */}`:

```tsx
{/* Prototype */}
<PrototypePanel
  prototype={prototype}
  loading={protoLoading}
  onGenerate={handleGeneratePrototype}
  onApprove={handleApprovePrototype}
  onReject={handleRejectPrototype}
/>
```

**Step 7: Add PrototypePanel component function**

Add after the `AnalysisPanel` function:

```tsx
function PrototypePanel({
  prototype, loading, onGenerate, onApprove, onReject
}: {
  prototype: Prototype | null;
  loading: boolean;
  onGenerate: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="bg-white rounded-lg border p-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-800">Prototype</h2>
        {(!prototype || prototype.status === 'rejected' || prototype.status === 'failed') && (
          <button
            onClick={onGenerate}
            disabled={loading}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Generating…' : prototype ? 'Regenerate' : 'Generate Prototype'}
          </button>
        )}
      </div>

      {!prototype && !loading && (
        <p className="text-sm text-gray-400">No prototype yet. Generate one to include a live demo in your bid.</p>
      )}

      {(loading || prototype?.status === 'generating') && (
        <div className="flex items-center gap-3 py-4">
          <div className="animate-spin h-5 w-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
          <p className="text-sm text-gray-500">Building prototype… ~30 seconds</p>
        </div>
      )}

      {prototype?.status === 'failed' && (
        <p className="text-sm text-red-500">Generation failed. Try again.</p>
      )}

      {prototype?.status === 'ready' && prototype.public_url && (
        <div>
          <div className="rounded border overflow-hidden mb-3" style={{ height: 320 }}>
            <iframe
              src={prototype.public_url}
              className="w-full h-full"
              title="Prototype preview"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
          <div className="flex items-center gap-3">
            <a
              href={prototype.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:underline"
            >
              View live ↗
            </a>
            <button
              onClick={onApprove}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
            >
              Approve — include in bid
            </button>
            <button
              onClick={onReject}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {prototype?.status === 'approved' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">Approved</span>
            <span className="text-xs text-gray-400">Will be included in bid proposal</span>
          </div>
          {prototype.public_url && (
            <a
              href={prototype.public_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:underline"
            >
              {prototype.public_url}
            </a>
          )}
        </div>
      )}

      {prototype?.status === 'rejected' && (
        <p className="text-sm text-gray-400">Prototype rejected. Generate a new one.</p>
      )}
    </div>
  );
}
```

**Step 8: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

**Step 9: Commit**

```bash
cd ..
git add frontend/src/pages/ProjectDetail.tsx
git commit -m "feat: add PrototypePanel to project detail page"
```

---

## Final Verification

```bash
# 1. All main app tests pass
docker compose exec api bundle exec rspec

# 2. All services running
docker compose ps
# Expected: api, sidekiq, redis, prototype-api all Up

# 3. Prototype API health
curl http://localhost:3001/health

# 4. End-to-end: open a project in the UI, click Generate Prototype
# Watch sidekiq logs:
docker compose logs sidekiq -f | grep -i prototype

# 5. After ~30s, prototype should appear with iframe preview
# 6. Click Approve — prototype URL should appear in bid proposal text when bid is approved
```
