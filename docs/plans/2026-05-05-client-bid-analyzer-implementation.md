# Client Bid Analyzer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add multi-role user auth (Freelancer.com OAuth 2.0) and a client-facing bid analysis dashboard powered by Claude via AWS Bedrock.

**Architecture:** Manual OAuth2 flow using Faraday (no new gems for OAuth). JWT tokens (jwt gem already installed) carry `user_id` and `role`. ApplicationController gains JWT middleware. A new `ClientPortal` module fetches bids using the client's OAuth token and runs Claude analysis. Separate `/api/v1/client/` and `/api/v1/admin/` namespaces. React SPA adds a Login page and role-based routing.

**Tech Stack:** Rails 8 API, Mongoid 9, JWT (already in Gemfile), Faraday (already in Gemfile), AWS Bedrock Claude Haiku, Sidekiq, React + TypeScript + Axios

---

## Environment Variables (add to .env)

```
FREELANCER_CLIENT_ID=...
FREELANCER_CLIENT_SECRET=...
FREELANCER_OAUTH_REDIRECT_URI=http://localhost:3000/api/v1/auth/freelancer/callback
FRONTEND_URL=http://localhost:5173
```

---

### Task 1: User Model + Factory

**Files:**
- Create: `app/models/user.rb`
- Create: `spec/models/user_spec.rb`
- Create: `spec/factories/users.rb`

**Step 1: Write the failing model spec**

```ruby
# spec/models/user_spec.rb
require "rails_helper"

RSpec.describe User, type: :model do
  it "is valid with required fields" do
    user = User.new(provider: "freelancer", provider_uid: "123", role: "client",
                    oauth_token: "tok", name: "Alice")
    expect(user).to be_valid
  end

  it "requires provider_uid uniqueness" do
    User.create!(provider: "freelancer", provider_uid: "123", role: "client",
                 oauth_token: "tok", name: "Alice")
    dup = User.new(provider: "freelancer", provider_uid: "123", role: "freelancer",
                   oauth_token: "tok2", name: "Bob")
    expect(dup).not_to be_valid
  end

  it "validates role is in allowed list" do
    user = User.new(provider: "freelancer", provider_uid: "456", role: "hacker",
                    oauth_token: "tok", name: "Eve")
    expect(user).not_to be_valid
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/models/user_spec.rb
```
Expected: FAIL — `uninitialized constant User`

**Step 3: Implement the model**

```ruby
# app/models/user.rb
class User
  include Mongoid::Document
  include Mongoid::Timestamps

  ROLES = %w[freelancer client super_admin].freeze

  field :provider,            type: String
  field :provider_uid,        type: String
  field :oauth_token,         type: String
  field :oauth_token_secret,  type: String
  field :role,                type: String
  field :name,                type: String
  field :email,               type: String
  field :avatar_url,          type: String

  validates :provider,     presence: true
  validates :provider_uid, presence: true, uniqueness: { scope: :provider }
  validates :role,         inclusion: { in: ROLES }
  validates :name,         presence: true

  index({ provider: 1, provider_uid: 1 }, { unique: true })
  index({ role: 1 })
end
```

**Step 4: Create the factory**

```ruby
# spec/factories/users.rb
FactoryBot.define do
  factory :user do
    provider     { "freelancer" }
    sequence(:provider_uid) { |n| "uid_#{n}" }
    oauth_token  { "test_token_#{SecureRandom.hex(8)}" }
    name         { Faker::Name.name }
    email        { Faker::Internet.email }
    role         { "freelancer" }

    trait :client do
      role { "client" }
    end

    trait :super_admin do
      role { "super_admin" }
    end
  end
end
```

**Step 5: Run and verify passing**

```bash
bundle exec rspec spec/models/user_spec.rb
```
Expected: 3 examples, 0 failures

**Step 6: Commit**

```bash
git add app/models/user.rb spec/models/user_spec.rb spec/factories/users.rb
git commit -m "feat: add User model with OAuth and role fields"
```

---

### Task 2: Auth::TokenService — JWT encode/decode

**Files:**
- Create: `app/modules/auth/token_service.rb`
- Create: `spec/modules/auth/token_service_spec.rb`

**Step 1: Write the failing spec**

```ruby
# spec/modules/auth/token_service_spec.rb
require "rails_helper"

RSpec.describe Auth::TokenService do
  describe ".encode / .decode" do
    it "encodes and decodes a payload" do
      token = described_class.encode(user_id: "abc123", role: "client")
      payload = described_class.decode(token)
      expect(payload["user_id"]).to eq("abc123")
      expect(payload["role"]).to eq("client")
    end

    it "raises InvalidToken for a blank token" do
      expect { described_class.decode("") }.to raise_error(Auth::TokenService::InvalidToken)
    end

    it "raises InvalidToken for a tampered token" do
      expect { described_class.decode("not.a.jwt") }.to raise_error(Auth::TokenService::InvalidToken)
    end

    it "raises InvalidToken for an expired token" do
      token = described_class.encode({ user_id: "x", role: "freelancer" }, exp: 1.second.ago)
      expect { described_class.decode(token) }.to raise_error(Auth::TokenService::InvalidToken)
    end
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/modules/auth/token_service_spec.rb
```
Expected: FAIL — `uninitialized constant Auth::TokenService`

**Step 3: Implement**

```ruby
# app/modules/auth/token_service.rb
module Auth
  class TokenService
    ALGORITHM = "HS256"

    class InvalidToken < StandardError; end

    def self.secret
      Rails.application.credentials.secret_key_base || ENV.fetch("SECRET_KEY_BASE")
    end

    def self.encode(payload, exp: 7.days.from_now)
      payload = payload.merge(exp: exp.to_i)
      JWT.encode(payload, secret, ALGORITHM)
    end

    def self.decode(token)
      raise InvalidToken, "No token provided" if token.blank?
      decoded = JWT.decode(token, secret, true, { algorithm: ALGORITHM })
      decoded.first.with_indifferent_access
    rescue JWT::DecodeError => e
      raise InvalidToken, e.message
    end
  end
end
```

**Step 4: Run and verify passing**

```bash
bundle exec rspec spec/modules/auth/token_service_spec.rb
```
Expected: 4 examples, 0 failures

**Step 5: Commit**

```bash
git add app/modules/auth/token_service.rb spec/modules/auth/token_service_spec.rb
git commit -m "feat: add Auth::TokenService for JWT encode/decode"
```

---

### Task 3: Auth::FreelancerOAuth — Manual OAuth2 flow

**Files:**
- Create: `app/modules/auth/freelancer_oauth.rb`
- Create: `spec/modules/auth/freelancer_oauth_spec.rb`

**Step 1: Write the failing spec**

```ruby
# spec/modules/auth/freelancer_oauth_spec.rb
require "rails_helper"

RSpec.describe Auth::FreelancerOAuth do
  describe ".authorize_url" do
    it "returns a Freelancer OAuth URL with role encoded in state" do
      url = described_class.authorize_url(role: "client")
      expect(url).to include("accounts.freelancer.com")
      expect(url).to include("response_type=code")
      expect(url).to include("state=")
    end
  end

  describe ".exchange_code" do
    it "exchanges code for token and returns user info with role" do
      # Stub token exchange
      stub_request(:post, "https://accounts.freelancer.com/oauth2/token")
        .to_return(
          status: 200,
          body: { access_token: "tok123", token_type: "bearer" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      # Stub user info
      stub_request(:get, /freelancer\.com\/api\/users\/0\.1\/self/)
        .to_return(
          status: 200,
          body: { result: { id: 42, display_name: "Alice", email: "alice@example.com" } }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      state = Auth::TokenService.encode({ role: "client" }, exp: 10.minutes.from_now)
      result = described_class.exchange_code(code: "authcode", state: state)

      expect(result[:role]).to eq("client")
      expect(result[:access_token]).to eq("tok123")
      expect(result[:user_info]["id"]).to eq(42)
    end

    it "raises on invalid state token" do
      expect {
        described_class.exchange_code(code: "x", state: "bad.state.token")
      }.to raise_error(Auth::TokenService::InvalidToken)
    end
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/modules/auth/freelancer_oauth_spec.rb
```
Expected: FAIL — `uninitialized constant Auth::FreelancerOAuth`

**Step 3: Implement**

```ruby
# app/modules/auth/freelancer_oauth.rb
module Auth
  class FreelancerOAuth
    AUTH_URL      = "https://accounts.freelancer.com/oauth2/authorize"
    TOKEN_URL     = "https://accounts.freelancer.com/oauth2/token"
    USERINFO_URL  = "https://www.freelancer.com/api/users/0.1/self"

    def self.authorize_url(role:)
      state = Auth::TokenService.encode({ role: role }, exp: 10.minutes.from_now)
      params = {
        client_id:     ENV.fetch("FREELANCER_CLIENT_ID", ""),
        redirect_uri:  ENV.fetch("FREELANCER_OAUTH_REDIRECT_URI", ""),
        response_type: "code",
        scope:         "basic",
        state:         state
      }
      "#{AUTH_URL}?#{params.to_query}"
    end

    def self.exchange_code(code:, state:)
      role_payload = Auth::TokenService.decode(state)
      role = role_payload["role"]

      access_token = fetch_access_token(code)
      user_info    = fetch_user_info(access_token)

      { role: role, access_token: access_token, user_info: user_info }
    end

    def self.fetch_access_token(code)
      conn = Faraday.new do |f|
        f.request :url_encoded
        f.response :json
      end
      response = conn.post(TOKEN_URL) do |req|
        req.body = {
          grant_type:    "authorization_code",
          code:          code,
          redirect_uri:  ENV.fetch("FREELANCER_OAUTH_REDIRECT_URI", ""),
          client_id:     ENV.fetch("FREELANCER_CLIENT_ID", ""),
          client_secret: ENV.fetch("FREELANCER_CLIENT_SECRET", "")
        }
      end
      raise "Token exchange failed: #{response.status}" unless response.success?
      response.body["access_token"]
    end

    def self.fetch_user_info(access_token)
      conn = Faraday.new do |f|
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = access_token
      end
      response = conn.get(USERINFO_URL, { compact: true })
      raise "User info fetch failed: #{response.status}" unless response.success?
      response.body["result"] || {}
    end
  end
end
```

**Step 4: Run and verify passing**

```bash
bundle exec rspec spec/modules/auth/freelancer_oauth_spec.rb
```
Expected: 3 examples, 0 failures

**Step 5: Commit**

```bash
git add app/modules/auth/freelancer_oauth.rb spec/modules/auth/freelancer_oauth_spec.rb
git commit -m "feat: add Auth::FreelancerOAuth for manual OAuth2 flow"
```

---

### Task 4: Auth Controller + Routes

**Files:**
- Create: `app/controllers/api/v1/auth/freelancer_controller.rb`
- Modify: `config/routes.rb`
- Create: `spec/requests/api/v1/auth/freelancer_spec.rb`

**Step 1: Write the failing spec**

```ruby
# spec/requests/api/v1/auth/freelancer_spec.rb
require "rails_helper"

RSpec.describe "Api::V1::Auth::Freelancer", type: :request do
  describe "GET /api/v1/auth/freelancer/authorize" do
    it "returns a redirect URL with role in state" do
      get "/api/v1/auth/freelancer/authorize", params: { role: "client" }

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["url"]).to include("accounts.freelancer.com")
    end

    it "defaults to freelancer role if role not provided" do
      get "/api/v1/auth/freelancer/authorize"
      json = JSON.parse(response.body)
      expect(json["url"]).to include("state=")
    end
  end

  describe "GET /api/v1/auth/freelancer/callback" do
    let(:state) { Auth::TokenService.encode({ role: "client" }, exp: 5.minutes.from_now) }

    before do
      stub_request(:post, "https://accounts.freelancer.com/oauth2/token")
        .to_return(
          status: 200,
          body: { access_token: "tok123" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )
      stub_request(:get, /freelancer\.com\/api\/users\/0\.1\/self/)
        .to_return(
          status: 200,
          body: { result: { id: 99, display_name: "Bob", email: "bob@example.com" } }.to_json,
          headers: { "Content-Type" => "application/json" }
        )
    end

    it "creates a user and redirects to frontend with JWT token" do
      expect {
        get "/api/v1/auth/freelancer/callback", params: { code: "authcode", state: state }
      }.to change(User, :count).by(1)

      expect(response).to have_http_status(:found)
      expect(response.location).to include("/auth/callback?token=")
    end

    it "finds existing user on subsequent login" do
      User.create!(provider: "freelancer", provider_uid: "99", role: "client",
                   oauth_token: "old_tok", name: "Bob")

      expect {
        get "/api/v1/auth/freelancer/callback", params: { code: "authcode", state: state }
      }.not_to change(User, :count)
    end
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/requests/api/v1/auth/freelancer_spec.rb
```
Expected: FAIL — routing error

**Step 3: Add routes**

```ruby
# config/routes.rb
Rails.application.routes.draw do
  get "/health", to: "health#show"
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      namespace :auth do
        get  "freelancer/authorize", to: "freelancer#authorize"
        get  "freelancer/callback",  to: "freelancer#callback"
      end

      resources :projects, only: [:index, :show] do
        member do
          post :approve_bid
          post :reject
          post :analyze
        end
      end

      resources :bids, only: [:index, :show]
      resource  :settings, only: [:show, :update]
      get       :dashboard, to: "dashboard#index"

      namespace :client do
        resources :projects, only: [:index, :show] do
          member do
            post :analyze_bids
          end
        end
        resources :analyses, only: [:show]
      end

      namespace :admin do
        resources :users, only: [:index, :update]
        get :stats, to: "stats#index"
      end
    end
  end
end
```

**Step 4: Implement the controller**

```ruby
# app/controllers/api/v1/auth/freelancer_controller.rb
module Api
  module V1
    module Auth
      class FreelancerController < ApplicationController
        skip_before_action :authenticate_user!

        def authorize
          role = params[:role].presence_in(%w[freelancer client]) || "freelancer"
          url  = ::Auth::FreelancerOAuth.authorize_url(role: role)
          render json: { url: url }
        end

        def callback
          result = ::Auth::FreelancerOAuth.exchange_code(
            code:  params[:code],
            state: params[:state]
          )

          user = User.find_or_initialize_by(
            provider:     "freelancer",
            provider_uid: result[:user_info]["id"].to_s
          )

          if user.new_record?
            user.role      = result[:role]
            user.name      = result[:user_info]["display_name"] || "Unknown"
            user.email     = result[:user_info]["email"]
            user.avatar_url = result[:user_info]["avatar_cdn"]
          end

          user.oauth_token = result[:access_token]
          user.save!

          token = ::Auth::TokenService.encode(user_id: user.id.to_s, role: user.role)
          redirect_to "#{ENV.fetch("FRONTEND_URL", "http://localhost:5173")}/auth/callback?token=#{token}",
                      allow_other_host: true
        rescue ::Auth::TokenService::InvalidToken => e
          render json: { error: "Invalid OAuth state: #{e.message}" }, status: :bad_request
        rescue => e
          Rails.logger.error("OAuth callback error: #{e.class}: #{e.message}")
          redirect_to "#{ENV.fetch("FRONTEND_URL", "http://localhost:5173")}/login?error=oauth_failed",
                      allow_other_host: true
        end
      end
    end
  end
end
```

**Step 5: Run and verify passing**

```bash
bundle exec rspec spec/requests/api/v1/auth/freelancer_spec.rb
```
Expected: 4 examples, 0 failures

**Step 6: Commit**

```bash
git add config/routes.rb app/controllers/api/v1/auth/freelancer_controller.rb \
        spec/requests/api/v1/auth/freelancer_spec.rb
git commit -m "feat: add Freelancer OAuth controller and auth routes"
```

---

### Task 5: ApplicationController JWT Middleware + Role Guards

**Files:**
- Modify: `app/controllers/application_controller.rb`
- Create: `spec/support/auth_helpers.rb`
- Modify: `spec/rails_helper.rb`

**Step 1: Implement ApplicationController**

```ruby
# app/controllers/application_controller.rb
class ApplicationController < ActionController::API
  before_action :authenticate_user!

  private

  def authenticate_user!
    token = request.headers["Authorization"]&.split(" ")&.last
    payload = Auth::TokenService.decode(token)
    @current_user_id = payload["user_id"]
    @current_role    = payload["role"]
  rescue Auth::TokenService::InvalidToken
    render json: { error: "Unauthorized" }, status: :unauthorized
  end

  def require_role!(*roles)
    return if roles.map(&:to_s).include?(@current_role)
    render json: { error: "Forbidden" }, status: :forbidden
  end

  def current_user
    @current_user ||= User.find(@current_user_id)
  rescue Mongoid::Errors::DocumentNotFound
    render json: { error: "Unauthorized" }, status: :unauthorized
  end
end
```

**Step 2: Create auth helper for specs**

```ruby
# spec/support/auth_helpers.rb
module AuthHelpers
  def jwt_headers(role: "freelancer", user_id: "test_user_id")
    token = Auth::TokenService.encode(user_id: user_id, role: role)
    { "Authorization" => "Bearer #{token}" }
  end

  def freelancer_headers
    jwt_headers(role: "freelancer")
  end

  def client_headers(user_id: "test_client_id")
    jwt_headers(role: "client", user_id: user_id)
  end

  def admin_headers
    jwt_headers(role: "super_admin")
  end
end
```

**Step 3: Include helper in rails_helper.rb**

In `spec/rails_helper.rb`, add inside `RSpec.configure do |config|`:

```ruby
require_relative "support/auth_helpers"

RSpec.configure do |config|
  # ... existing config ...
  config.include AuthHelpers, type: :request
end
```

**Step 4: Update all existing request specs to send JWT headers**

In each existing request spec file, update every `get`/`post`/`patch` call:

```ruby
# spec/requests/api/v1/projects_spec.rb — example of changes needed:
# Before:  get "/api/v1/projects"
# After:   get "/api/v1/projects", headers: freelancer_headers

# Before:  post "/api/v1/projects/#{project.id}/approve_bid"
# After:   post "/api/v1/projects/#{project.id}/approve_bid", headers: freelancer_headers
```

Apply the same pattern to:
- `spec/requests/api/v1/projects_spec.rb`
- `spec/requests/api/v1/bids_spec.rb`
- `spec/requests/api/v1/dashboard_spec.rb`
- `spec/requests/api/v1/settings_spec.rb`

**Step 5: Run full test suite and verify passing**

```bash
bundle exec rspec spec/requests/
```
Expected: all existing request specs pass with JWT headers

**Step 6: Add a spec verifying role protection**

```ruby
# spec/requests/api/v1/projects_spec.rb — add:
describe "role protection" do
  it "returns 401 without a JWT token" do
    get "/api/v1/projects"
    expect(response).to have_http_status(:unauthorized)
  end

  it "returns 401 with a bad token" do
    get "/api/v1/projects", headers: { "Authorization" => "Bearer bad.token" }
    expect(response).to have_http_status(:unauthorized)
  end
end
```

**Step 7: Run and verify**

```bash
bundle exec rspec spec/requests/api/v1/projects_spec.rb
```
Expected: all pass

**Step 8: Commit**

```bash
git add app/controllers/application_controller.rb spec/support/auth_helpers.rb \
        spec/rails_helper.rb spec/requests/
git commit -m "feat: add JWT middleware to ApplicationController, update request specs"
```

---

### Task 6: ClientAnalysis Model

**Files:**
- Create: `app/models/client_analysis.rb`
- Create: `spec/models/client_analysis_spec.rb`

**Step 1: Write the failing spec**

```ruby
# spec/models/client_analysis_spec.rb
require "rails_helper"

RSpec.describe ClientAnalysis, type: :model do
  let(:user) { FactoryBot.create(:user, :client) }

  it "is valid with required fields" do
    ca = ClientAnalysis.new(
      project_freelancer_id: "p123",
      client_user_id: user.id.to_s,
      shortlist: [{ rank: 1, bidder_name: "Alice", score: 85 }]
    )
    expect(ca).to be_valid
  end

  it "requires project_freelancer_id" do
    ca = ClientAnalysis.new(client_user_id: user.id.to_s, shortlist: [])
    expect(ca).not_to be_valid
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/models/client_analysis_spec.rb
```

**Step 3: Implement**

```ruby
# app/models/client_analysis.rb
class ClientAnalysis
  include Mongoid::Document
  include Mongoid::Timestamps

  field :project_freelancer_id, type: String
  field :client_user_id,        type: String
  field :shortlist,             type: Array, default: []
  field :analyzed_at,           type: Time

  validates :project_freelancer_id, presence: true
  validates :client_user_id,        presence: true

  index({ project_freelancer_id: 1, client_user_id: 1 }, { unique: true })
  index({ client_user_id: 1 })
end
```

**Step 4: Run and verify passing**

```bash
bundle exec rspec spec/models/client_analysis_spec.rb
```
Expected: 2 examples, 0 failures

**Step 5: Commit**

```bash
git add app/models/client_analysis.rb spec/models/client_analysis_spec.rb
git commit -m "feat: add ClientAnalysis model"
```

---

### Task 7: ClientPortal::FreelancerClient

**Files:**
- Create: `app/modules/client_portal/freelancer_client.rb`
- Create: `spec/modules/client_portal/freelancer_client_spec.rb`

**Step 1: Write the failing spec**

```ruby
# spec/modules/client_portal/freelancer_client_spec.rb
require "rails_helper"

RSpec.describe ClientPortal::FreelancerClient do
  let(:token) { "client_oauth_token" }
  subject { described_class.new(token) }

  describe "#list_projects" do
    it "returns client's active projects" do
      stub_request(:get, /freelancer\.com\/api\/projects.*active/)
        .to_return(
          status: 200,
          body: {
            result: {
              projects: [
                { id: 1, title: "Build a website", bid_stats: { bid_count: 10 },
                  budget: { minimum: 100, maximum: 500 }, currency: { code: "USD" },
                  jobs: [], description: "Need a site" }
              ]
            }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      projects = subject.list_projects
      expect(projects.length).to eq(1)
      expect(projects.first[:title]).to eq("Build a website")
      expect(projects.first[:bid_count]).to eq(10)
    end

    it "returns empty array on API failure" do
      stub_request(:get, /freelancer\.com\/api\/projects/).to_return(status: 500)
      expect(subject.list_projects).to eq([])
    end
  end

  describe "#list_bids" do
    it "returns bids for a project" do
      stub_request(:get, /freelancer\.com\/api\/projects.*bids/)
        .to_return(
          status: 200,
          body: {
            result: {
              bids: [
                { id: 10, bidder_id: 5, amount: 300, period: 7,
                  description: "I can do this",
                  bidder_details: {
                    username: "alice_dev",
                    reputation: { entire_history: { overall: 4.8, reviews: 25 } },
                    status: { payment_verified: true }
                  }
                }
              ]
            }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      bids = subject.list_bids("42")
      expect(bids.length).to eq(1)
      expect(bids.first[:bidder_name]).to eq("alice_dev")
      expect(bids.first[:amount]).to eq(300)
    end
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/modules/client_portal/freelancer_client_spec.rb
```

**Step 3: Implement**

```ruby
# app/modules/client_portal/freelancer_client.rb
module ClientPortal
  class FreelancerClient
    BASE_URL = ENV.fetch("FREELANCER_API_BASE_URL", "https://www.freelancer.com/api")

    def initialize(oauth_token)
      @conn = Faraday.new(url: BASE_URL) do |f|
        f.request :json
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = oauth_token
      end
    end

    def list_projects
      response = @conn.get("projects/0.1/projects/active") do |req|
        req.params["owner_id"]        = "self"
        req.params["compact"]         = false
        req.params["bid_details"]     = true
        req.params["full_description"] = true
      end
      return [] unless response.success?
      (response.body.dig("result", "projects") || []).map { |p| normalize_project(p) }
    rescue Faraday::Error => e
      Rails.logger.error("ClientPortal::FreelancerClient#list_projects: #{e.message}")
      []
    end

    def list_bids(project_id)
      response = @conn.get("projects/0.1/bids") do |req|
        req.params["project_ids[]"]  = project_id
        req.params["bidder_details"] = true
        req.params["limit"]          = 100
      end
      return [] unless response.success?
      (response.body.dig("result", "bids") || []).map { |b| normalize_bid(b) }
    rescue Faraday::Error => e
      Rails.logger.error("ClientPortal::FreelancerClient#list_bids: #{e.message}")
      []
    end

    private

    def normalize_project(p)
      {
        freelancer_id: p["id"].to_s,
        title:         p["title"],
        description:   p["description"] || p["preview_description"],
        budget_range:  {
          min:      p.dig("budget", "minimum"),
          max:      p.dig("budget", "maximum"),
          currency: p.dig("currency", "code") || "USD"
        },
        skills_required: (p["jobs"] || []).map { |j| j["name"] },
        bid_count:  p.dig("bid_stats", "bid_count") || 0,
        bid_avg:    p.dig("bid_stats", "bid_avg")&.round(2)
      }
    end

    def normalize_bid(b)
      bidder  = b["bidder_details"] || {}
      history = bidder.dig("reputation", "entire_history") || {}
      {
        bid_id:           b["id"].to_s,
        bidder_id:        b["bidder_id"].to_s,
        bidder_name:      bidder["username"],
        amount:           b["amount"],
        delivery_days:    b["period"],
        proposal_text:    b["description"],
        bidder_rating:    history["overall"]&.to_f,
        bidder_reviews:   history["reviews"]&.to_i || 0,
        payment_verified: bidder.dig("status", "payment_verified") || false
      }
    end
  end
end
```

**Step 4: Run and verify passing**

```bash
bundle exec rspec spec/modules/client_portal/freelancer_client_spec.rb
```
Expected: 4 examples, 0 failures

**Step 5: Commit**

```bash
git add app/modules/client_portal/freelancer_client.rb \
        spec/modules/client_portal/freelancer_client_spec.rb
git commit -m "feat: add ClientPortal::FreelancerClient"
```

---

### Task 8: ClientPortal::BidAnalyzer

**Files:**
- Create: `app/modules/client_portal/bid_analyzer.rb`
- Create: `spec/modules/client_portal/bid_analyzer_spec.rb`

**Step 1: Write the failing spec**

```ruby
# spec/modules/client_portal/bid_analyzer_spec.rb
require "rails_helper"

RSpec.describe ClientPortal::BidAnalyzer do
  subject { described_class.new }

  let(:project) do
    {
      title: "Build a REST API",
      description: "Need a Rails API with authentication",
      budget_range: { min: 200, max: 800, currency: "USD" },
      skills_required: ["Ruby on Rails", "PostgreSQL"]
    }
  end

  let(:bids) do
    [
      { bidder_name: "alice_dev", amount: 500, delivery_days: 7,
        proposal_text: "I have built many Rails APIs.", bidder_rating: 4.9,
        bidder_reviews: 45, payment_verified: true },
      { bidder_name: "bob_coder", amount: 300, delivery_days: 14,
        proposal_text: "I can help.", bidder_rating: 3.2,
        bidder_reviews: 5, payment_verified: false }
    ]
  end

  let(:bedrock_response) do
    {
      shortlist: [
        { rank: 1, bidder_name: "alice_dev", bid_amount: 500, score: 88,
          strengths: ["strong portfolio"], concerns: ["above budget midpoint"],
          summary: "Best fit overall." },
        { rank: 2, bidder_name: "bob_coder", bid_amount: 300, score: 55,
          strengths: ["lowest price"], concerns: ["few reviews", "vague proposal"],
          summary: "Budget option, higher risk." }
      ]
    }.to_json
  end

  it "returns a shortlist from Bedrock" do
    allow_any_instance_of(Aws::BedrockRuntime::Client).to receive(:converse)
      .and_return(
        double(output: double(message: double(content: [double(text: bedrock_response)])))
      )

    result = subject.analyze(project: project, bids: bids)
    expect(result["shortlist"].length).to eq(2)
    expect(result["shortlist"].first["rank"]).to eq(1)
    expect(result["shortlist"].first["bidder_name"]).to eq("alice_dev")
  end

  it "returns nil on Bedrock error" do
    allow_any_instance_of(Aws::BedrockRuntime::Client).to receive(:converse)
      .and_raise(Aws::BedrockRuntime::Errors::ServiceError.new(nil, "error"))

    result = subject.analyze(project: project, bids: bids)
    expect(result).to be_nil
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/modules/client_portal/bid_analyzer_spec.rb
```

**Step 3: Implement**

```ruby
# app/modules/client_portal/bid_analyzer.rb
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
            Proposal: #{bid[:proposal_text]&.truncate(300)}
        BID
      end.join("\n")

      <<~PROMPT
        You are helping a client evaluate freelance bids for their project.

        PROJECT:
        Title: #{project[:title]}
        Description: #{project[:description]&.truncate(500)}
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
              "strengths": ["<strength 1>", "<strength 2>"],
              "concerns": ["<concern 1>"],
              "summary": "<1 sentence recommendation>"
            }
          ]
        }

        Rank by: proposal quality and specificity, bidder rating and review count,
        value for money (not just lowest price), payment verification, realistic delivery time.
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
```

**Step 4: Run and verify passing**

```bash
bundle exec rspec spec/modules/client_portal/bid_analyzer_spec.rb
```
Expected: 2 examples, 0 failures

**Step 5: Commit**

```bash
git add app/modules/client_portal/bid_analyzer.rb \
        spec/modules/client_portal/bid_analyzer_spec.rb
git commit -m "feat: add ClientPortal::BidAnalyzer using Claude via Bedrock"
```

---

### Task 9: ClientPortal::AnalyzeBidsJob

**Files:**
- Create: `app/modules/client_portal/analyze_bids_job.rb`
- Create: `spec/modules/client_portal/analyze_bids_job_spec.rb`

**Step 1: Write the failing spec**

```ruby
# spec/modules/client_portal/analyze_bids_job_spec.rb
require "rails_helper"

RSpec.describe ClientPortal::AnalyzeBidsJob do
  let(:user) { FactoryBot.create(:user, :client, oauth_token: "tok") }
  let(:project_info) do
    { "freelancer_id" => "p42", "title" => "API project",
      "description" => "desc", "budget_range" => {}, "skills_required" => [] }
  end

  it "creates a ClientAnalysis record on success" do
    bids = [{ bidder_name: "Alice", amount: 400, delivery_days: 7,
              proposal_text: "Good", bidder_rating: 4.5, bidder_reviews: 10,
              payment_verified: true }]

    allow_any_instance_of(ClientPortal::FreelancerClient).to receive(:list_bids).and_return(bids)
    allow_any_instance_of(ClientPortal::BidAnalyzer).to receive(:analyze).and_return(
      { "shortlist" => [{ "rank" => 1, "bidder_name" => "Alice", "score" => 80 }] }
    )

    expect {
      described_class.new.perform(user.id.to_s, project_info)
    }.to change(ClientAnalysis, :count).by(1)

    ca = ClientAnalysis.find_by(project_freelancer_id: "p42")
    expect(ca.shortlist.length).to eq(1)
  end

  it "skips if no bids available" do
    allow_any_instance_of(ClientPortal::FreelancerClient).to receive(:list_bids).and_return([])

    expect {
      described_class.new.perform(user.id.to_s, project_info)
    }.not_to change(ClientAnalysis, :count)
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/modules/client_portal/analyze_bids_job_spec.rb
```

**Step 3: Implement**

```ruby
# app/modules/client_portal/analyze_bids_job.rb
module ClientPortal
  class AnalyzeBidsJob
    include Sidekiq::Job
    sidekiq_options queue: :default, retry: 2

    def perform(user_id, project_info)
      user = User.find(user_id)
      fl_client = ClientPortal::FreelancerClient.new(user.oauth_token)

      bids = fl_client.list_bids(project_info["freelancer_id"])
      return if bids.empty?

      project = project_info.transform_keys(&:to_sym)
      result  = ClientPortal::BidAnalyzer.new.analyze(project: project, bids: bids)
      return unless result

      ClientAnalysis.find_or_initialize_by(
        project_freelancer_id: project_info["freelancer_id"],
        client_user_id:        user_id
      ).tap do |ca|
        ca.shortlist    = result["shortlist"] || []
        ca.analyzed_at  = Time.current
        ca.save!
      end
    rescue Mongoid::Errors::DocumentNotFound
      Rails.logger.warn("ClientPortal::AnalyzeBidsJob: user #{user_id} not found")
    end
  end
end
```

**Step 4: Run and verify passing**

```bash
bundle exec rspec spec/modules/client_portal/analyze_bids_job_spec.rb
```
Expected: 2 examples, 0 failures

**Step 5: Commit**

```bash
git add app/modules/client_portal/analyze_bids_job.rb \
        spec/modules/client_portal/analyze_bids_job_spec.rb
git commit -m "feat: add ClientPortal::AnalyzeBidsJob"
```

---

### Task 10: Client API Controllers

**Files:**
- Create: `app/controllers/api/v1/client/projects_controller.rb`
- Create: `app/controllers/api/v1/client/analyses_controller.rb`
- Create: `spec/requests/api/v1/client/projects_spec.rb`
- Create: `spec/requests/api/v1/client/analyses_spec.rb`

**Step 1: Write the failing specs**

```ruby
# spec/requests/api/v1/client/projects_spec.rb
require "rails_helper"

RSpec.describe "Api::V1::Client::Projects", type: :request do
  let(:user) { FactoryBot.create(:user, :client, oauth_token: "tok") }
  let(:headers) { client_headers(user_id: user.id.to_s) }

  describe "GET /api/v1/client/projects" do
    it "returns the client's Freelancer projects" do
      allow_any_instance_of(ClientPortal::FreelancerClient)
        .to receive(:list_projects)
        .and_return([{ freelancer_id: "1", title: "My Project", bid_count: 5 }])

      get "/api/v1/client/projects", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["projects"].length).to eq(1)
    end

    it "returns 403 for a freelancer user" do
      get "/api/v1/client/projects", headers: freelancer_headers
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/client/projects/:id/analyze_bids" do
    it "queues an AnalyzeBidsJob" do
      allow_any_instance_of(ClientPortal::FreelancerClient)
        .to receive(:list_projects)
        .and_return([{ freelancer_id: "42", title: "Project", bid_count: 3,
                       description: "desc", budget_range: {}, skills_required: [] }])

      expect {
        post "/api/v1/client/projects/42/analyze_bids", headers: headers
      }.to change(Sidekiq::Queues["default"], :size).by(1)

      expect(response).to have_http_status(:ok)
    end
  end
end
```

```ruby
# spec/requests/api/v1/client/analyses_spec.rb
require "rails_helper"

RSpec.describe "Api::V1::Client::Analyses", type: :request do
  let(:user) { FactoryBot.create(:user, :client) }
  let(:headers) { client_headers(user_id: user.id.to_s) }

  describe "GET /api/v1/client/analyses/:id" do
    it "returns an analysis for the current user" do
      ca = ClientAnalysis.create!(
        project_freelancer_id: "p1",
        client_user_id: user.id.to_s,
        shortlist: [{ rank: 1, bidder_name: "Alice", score: 90 }],
        analyzed_at: Time.current
      )

      get "/api/v1/client/analyses/#{ca.id}", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["analysis"]["shortlist"].length).to eq(1)
    end

    it "returns 404 for another user's analysis" do
      other = FactoryBot.create(:user, :client)
      ca = ClientAnalysis.create!(
        project_freelancer_id: "p2",
        client_user_id: other.id.to_s,
        shortlist: []
      )

      get "/api/v1/client/analyses/#{ca.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end
end
```

**Step 2: Run to verify they fail**

```bash
bundle exec rspec spec/requests/api/v1/client/
```

**Step 3: Implement projects controller**

```ruby
# app/controllers/api/v1/client/projects_controller.rb
module Api
  module V1
    module Client
      class ProjectsController < ApplicationController
        before_action :require_client!

        def index
          fl = ClientPortal::FreelancerClient.new(current_user.oauth_token)
          projects = fl.list_projects
          render json: { projects: projects }
        end

        def analyze_bids
          fl = ClientPortal::FreelancerClient.new(current_user.oauth_token)
          projects = fl.list_projects
          project = projects.find { |p| p[:freelancer_id] == params[:id] }

          return render json: { error: "Project not found" }, status: :not_found unless project

          ClientPortal::AnalyzeBidsJob.perform_async(
            @current_user_id,
            project.transform_keys(&:to_s)
          )
          render json: { message: "Bid analysis queued" }
        end

        private

        def require_client!
          require_role!(:client, :super_admin)
        end
      end
    end
  end
end
```

**Step 4: Implement analyses controller**

```ruby
# app/controllers/api/v1/client/analyses_controller.rb
module Api
  module V1
    module Client
      class AnalysesController < ApplicationController
        before_action :require_role!, :client, :super_admin

        def show
          ca = ClientAnalysis.find_by(id: params[:id], client_user_id: @current_user_id)
          return render json: { error: "Not found" }, status: :not_found unless ca

          render json: {
            analysis: {
              id:                    ca.id.to_s,
              project_freelancer_id: ca.project_freelancer_id,
              shortlist:             ca.shortlist,
              analyzed_at:           ca.analyzed_at
            }
          }
        end
      end
    end
  end
end
```

Note: Fix the `require_role!` call — it takes splat args. Update to:

```ruby
before_action { require_role!(:client, :super_admin) }
```

**Step 5: Run and verify passing**

```bash
bundle exec rspec spec/requests/api/v1/client/
```
Expected: all pass

**Step 6: Commit**

```bash
git add app/controllers/api/v1/client/ spec/requests/api/v1/client/
git commit -m "feat: add Client API controllers for projects and analyses"
```

---

### Task 11: Admin API Controllers

**Files:**
- Create: `app/controllers/api/v1/admin/users_controller.rb`
- Create: `app/controllers/api/v1/admin/stats_controller.rb`
- Create: `spec/requests/api/v1/admin/users_spec.rb`

**Step 1: Write the failing spec**

```ruby
# spec/requests/api/v1/admin/users_spec.rb
require "rails_helper"

RSpec.describe "Api::V1::Admin::Users", type: :request do
  describe "GET /api/v1/admin/users" do
    it "returns all users for super_admin" do
      FactoryBot.create(:user, :client)
      FactoryBot.create(:user)

      get "/api/v1/admin/users", headers: admin_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["users"].length).to eq(2)
    end

    it "returns 403 for non-admin" do
      get "/api/v1/admin/users", headers: freelancer_headers
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH /api/v1/admin/users/:id" do
    it "updates a user's role" do
      user = FactoryBot.create(:user, role: "client")

      patch "/api/v1/admin/users/#{user.id}",
            params: { role: "freelancer" }.to_json,
            headers: admin_headers.merge("Content-Type" => "application/json")

      expect(response).to have_http_status(:ok)
      expect(user.reload.role).to eq("freelancer")
    end

    it "rejects invalid roles" do
      user = FactoryBot.create(:user)
      patch "/api/v1/admin/users/#{user.id}",
            params: { role: "hacker" }.to_json,
            headers: admin_headers.merge("Content-Type" => "application/json")
      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/requests/api/v1/admin/users_spec.rb
```

**Step 3: Implement users controller**

```ruby
# app/controllers/api/v1/admin/users_controller.rb
module Api
  module V1
    module Admin
      class UsersController < ApplicationController
        before_action { require_role!(:super_admin) }

        def index
          users = User.all.order(created_at: :desc)
          render json: { users: users.map { |u| serialize_user(u) } }
        end

        def update
          user = User.find(params[:id])
          new_role = params[:role]

          unless User::ROLES.include?(new_role)
            return render json: { error: "Invalid role" }, status: :unprocessable_content
          end

          user.update!(role: new_role)
          render json: { user: serialize_user(user) }
        rescue Mongoid::Errors::DocumentNotFound
          render json: { error: "User not found" }, status: :not_found
        end

        private

        def serialize_user(user)
          {
            id:          user.id.to_s,
            name:        user.name,
            email:       user.email,
            role:        user.role,
            provider:    user.provider,
            avatar_url:  user.avatar_url,
            created_at:  user.created_at
          }
        end
      end
    end
  end
end
```

**Step 4: Implement stats controller**

```ruby
# app/controllers/api/v1/admin/stats_controller.rb
module Api
  module V1
    module Admin
      class StatsController < ApplicationController
        before_action { require_role!(:super_admin) }

        def index
          render json: {
            stats: {
              users: {
                total:      User.count,
                freelancers: User.where(role: "freelancer").count,
                clients:     User.where(role: "client").count
              },
              projects:  {
                total:     Project.count,
                by_status: Project::STATUSES.index_with { |s| Project.where(status: s).count }
              },
              analyses: {
                total: ClientAnalysis.count
              }
            }
          }
        end
      end
    end
  end
end
```

**Step 5: Run and verify passing**

```bash
bundle exec rspec spec/requests/api/v1/admin/
```
Expected: all pass

**Step 6: Commit**

```bash
git add app/controllers/api/v1/admin/ spec/requests/api/v1/admin/
git commit -m "feat: add Admin API controllers for user management and stats"
```

---

### Task 12: Frontend — Auth Context + Token Storage + Axios Interceptor

**Files:**
- Create: `frontend/src/auth/AuthContext.tsx`
- Create: `frontend/src/auth/useAuth.ts`
- Modify: `frontend/src/api/client.ts`
- Create: `frontend/src/pages/AuthCallback.tsx`

**Step 1: Create AuthContext**

```tsx
// frontend/src/auth/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AuthUser {
  user_id: string;
  role: 'freelancer' | 'client' | 'super_admin';
  exp: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function parseToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return null;
    return payload as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('auth_token');
    if (stored) {
      const parsed = parseToken(stored);
      if (parsed) {
        setToken(stored);
        setUser(parsed);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string) => {
    const parsed = parseToken(newToken);
    if (!parsed) return;
    localStorage.setItem('auth_token', newToken);
    setToken(newToken);
    setUser(parsed);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

**Step 2: Add axios interceptor to api/client.ts**

```ts
// frontend/src/api/client.ts — replace the existing file
import axios from 'axios';
import type { Project, Bid, DashboardData, Settings } from '../types/api';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Existing freelancer API functions (unchanged)
export const fetchDashboard = () => api.get<DashboardData>('/dashboard');
export const fetchProjects = (status?: string) =>
  api.get<{ projects: Project[] }>('/projects', { params: status ? { status } : {} });
export const fetchProject = (id: string) => api.get<{ project: Project }>(`/projects/${id}`);
export const fetchBids = (status?: string) =>
  api.get<{ bids: Bid[] }>('/bids', { params: status ? { status } : {} });
export const approveBid = (projectId: string) =>
  api.post<{ message: string }>(`/projects/${projectId}/approve_bid`);
export const rejectProject = (projectId: string) =>
  api.post<{ project: Project }>(`/projects/${projectId}/reject`);
export const analyzeProject = (projectId: string) =>
  api.post<{ message: string }>(`/projects/${projectId}/analyze`);
export const fetchSettings = () => api.get<{ settings: Settings }>('/settings');
export const updateSettings = (data: Partial<Settings>) =>
  api.patch<{ settings: Settings }>('/settings', data);

// Auth API
export const getOAuthUrl = (role: 'freelancer' | 'client') =>
  api.get<{ url: string }>(`/auth/freelancer/authorize?role=${role}`);

// Client API
export const fetchClientProjects = () => api.get<{ projects: ClientProject[] }>('/client/projects');
export const analyzeClientBids = (projectId: string) =>
  api.post<{ message: string }>(`/client/projects/${projectId}/analyze_bids`);
export const fetchAnalysis = (analysisId: string) =>
  api.get<{ analysis: ClientAnalysisResult }>(`/client/analyses/${analysisId}`);

// Admin API
export const fetchAdminUsers = () => api.get<{ users: AdminUser[] }>('/admin/users');
export const updateUserRole = (userId: string, role: string) =>
  api.patch<{ user: AdminUser }>(`/admin/users/${userId}`, { role });
export const fetchAdminStats = () => api.get<{ stats: AdminStats }>('/admin/stats');

export default api;
```

**Step 3: Create AuthCallback page**

```tsx
// frontend/src/pages/AuthCallback.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      navigate('/login?error=' + error);
      return;
    }

    if (token) {
      login(token);
    } else {
      navigate('/login?error=no_token');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'client') navigate('/client/projects');
    else if (user.role === 'super_admin') navigate('/admin/users');
    else navigate('/');
  }, [user]);

  return <div className="flex items-center justify-center min-h-screen">Signing you in...</div>;
}
```

**Step 4: Commit**

```bash
git add frontend/src/auth/ frontend/src/api/client.ts frontend/src/pages/AuthCallback.tsx
git commit -m "feat: add frontend auth context, axios interceptor, OAuth callback page"
```

---

### Task 13: Frontend — Login Page

**Files:**
- Create: `frontend/src/pages/Login.tsx`

```tsx
// frontend/src/pages/Login.tsx
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getOAuthUrl } from '../api/client';

export default function Login() {
  const [loading, setLoading] = useState<'freelancer' | 'client' | null>(null);
  const [params] = useSearchParams();
  const error = params.get('error');

  const handleLogin = async (role: 'freelancer' | 'client') => {
    setLoading(role);
    try {
      const { data } = await getOAuthUrl(role);
      window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border p-10 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Freelancing Agent</h1>
        <p className="text-gray-500 mb-8">Connect your Freelancer.com account to get started</p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            Login failed. Please try again.
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => handleLogin('freelancer')}
            disabled={loading !== null}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === 'freelancer' ? 'Redirecting...' : 'Login as Freelancer'}
          </button>
          <button
            onClick={() => handleLogin('client')}
            disabled={loading !== null}
            className="w-full py-3 px-4 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {loading === 'client' ? 'Redirecting...' : 'Login as Client'}
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          You will be redirected to Freelancer.com to authorize access
        </p>
      </div>
    </div>
  );
}
```

**Commit:**

```bash
git add frontend/src/pages/Login.tsx
git commit -m "feat: add Login page with role selector"
```

---

### Task 14: Frontend — App.tsx Refactor (Protected Routes + Role Routing)

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

**Step 1: Wrap app with AuthProvider in main.tsx**

```tsx
// frontend/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
```

**Step 2: Refactor App.tsx with protected routes and role-based nav**

```tsx
// frontend/src/App.tsx
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Bids from './pages/Bids';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import ClientProjects from './pages/client/ClientProjects';
import ClientProjectDetail from './pages/client/ClientProjectDetail';
import ClientAnalysis from './pages/client/ClientAnalysis';
import AdminUsers from './pages/admin/AdminUsers';
import AdminStats from './pages/admin/AdminStats';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="p-8 text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function FreelancerNav() {
  const { logout } = useAuth();
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-900 mr-4">Freelancing Agent</span>
        {[['/', 'Dashboard'], ['/projects', 'Projects'], ['/bids', 'Bids'], ['/settings', 'Settings']].map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'}>
            {label}
          </NavLink>
        ))}
        <button onClick={logout} className="ml-auto text-sm text-gray-500 hover:text-gray-900">Logout</button>
      </div>
    </nav>
  );
}

function ClientNav() {
  const { logout } = useAuth();
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-900 mr-4">Freelancing Agent</span>
        <NavLink to="/client/projects" className={({ isActive }) => isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'}>
          My Projects
        </NavLink>
        <button onClick={logout} className="ml-auto text-sm text-gray-500 hover:text-gray-900">Logout</button>
      </div>
    </nav>
  );
}

function AdminNav() {
  const { logout } = useAuth();
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
        <span className="font-bold text-gray-900 mr-4">Freelancing Agent — Admin</span>
        <NavLink to="/admin/users" className={({ isActive }) => isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'}>Users</NavLink>
        <NavLink to="/admin/stats" className={({ isActive }) => isActive ? 'font-semibold text-blue-600' : 'text-gray-600 hover:text-gray-900'}>Stats</NavLink>
        <button onClick={logout} className="ml-auto text-sm text-gray-500 hover:text-gray-900">Logout</button>
      </div>
    </nav>
  );
}

function AppLayout({ nav, children }: { nav: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {nav}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Freelancer routes */}
        <Route path="/" element={<ProtectedRoute roles={['freelancer', 'super_admin']}><AppLayout nav={<FreelancerNav />}><Dashboard /></AppLayout></ProtectedRoute>} />
        <Route path="/projects" element={<ProtectedRoute roles={['freelancer', 'super_admin']}><AppLayout nav={<FreelancerNav />}><Projects /></AppLayout></ProtectedRoute>} />
        <Route path="/projects/:id" element={<ProtectedRoute roles={['freelancer', 'super_admin']}><AppLayout nav={<FreelancerNav />}><ProjectDetail /></AppLayout></ProtectedRoute>} />
        <Route path="/bids" element={<ProtectedRoute roles={['freelancer', 'super_admin']}><AppLayout nav={<FreelancerNav />}><Bids /></AppLayout></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute roles={['freelancer', 'super_admin']}><AppLayout nav={<FreelancerNav />}><Settings /></AppLayout></ProtectedRoute>} />

        {/* Client routes */}
        <Route path="/client/projects" element={<ProtectedRoute roles={['client', 'super_admin']}><AppLayout nav={<ClientNav />}><ClientProjects /></AppLayout></ProtectedRoute>} />
        <Route path="/client/projects/:id" element={<ProtectedRoute roles={['client', 'super_admin']}><AppLayout nav={<ClientNav />}><ClientProjectDetail /></AppLayout></ProtectedRoute>} />
        <Route path="/client/analyses/:id" element={<ProtectedRoute roles={['client', 'super_admin']}><AppLayout nav={<ClientNav />}><ClientAnalysis /></AppLayout></ProtectedRoute>} />

        {/* Admin routes */}
        <Route path="/admin/users" element={<ProtectedRoute roles={['super_admin']}><AppLayout nav={<AdminNav />}><AdminUsers /></AppLayout></ProtectedRoute>} />
        <Route path="/admin/stats" element={<ProtectedRoute roles={['super_admin']}><AppLayout nav={<AdminNav />}><AdminStats /></AppLayout></ProtectedRoute>} />

        <Route path="*" element={<Navigate to={user ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

**Commit:**

```bash
git add frontend/src/App.tsx frontend/src/main.tsx
git commit -m "feat: refactor App.tsx with role-based protected routes and nav"
```

---

### Task 15: Frontend — Client Pages

**Files:**
- Create: `frontend/src/pages/client/ClientProjects.tsx`
- Create: `frontend/src/pages/client/ClientProjectDetail.tsx`
- Create: `frontend/src/pages/client/ClientAnalysis.tsx`
- Add types to: `frontend/src/types/api.ts`

**Step 1: Add client types to api.ts**

Append to `frontend/src/types/api.ts`:

```ts
export interface ClientProject {
  freelancer_id: string;
  title: string;
  description?: string;
  budget_range: { min?: number; max?: number; currency?: string };
  skills_required: string[];
  bid_count: number;
  bid_avg?: number;
}

export interface BidShortlistItem {
  rank: number;
  bidder_name: string;
  bid_amount: number;
  score: number;
  strengths: string[];
  concerns: string[];
  summary: string;
}

export interface ClientAnalysisResult {
  id: string;
  project_freelancer_id: string;
  shortlist: BidShortlistItem[];
  analyzed_at: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  provider: string;
  avatar_url?: string;
  created_at: string;
}

export interface AdminStats {
  users: { total: number; freelancers: number; clients: number };
  projects: { total: number; by_status: Record<string, number> };
  analyses: { total: number };
}
```

**Step 2: ClientProjects page**

```tsx
// frontend/src/pages/client/ClientProjects.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchClientProjects, analyzeClientBids } from '../../api/client';
import type { ClientProject } from '../../types/api';

export default function ClientProjects() {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  useEffect(() => {
    fetchClientProjects()
      .then(r => setProjects(r.data.projects))
      .finally(() => setLoading(false));
  }, []);

  const handleAnalyze = async (id: string) => {
    setAnalyzing(id);
    try {
      await analyzeClientBids(id);
      alert('Analysis queued — refresh in a moment to see results.');
    } finally {
      setAnalyzing(null);
    }
  };

  if (loading) return <div className="text-gray-500">Loading projects...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Projects</h1>
      {projects.length === 0 && <p className="text-gray-500">No active projects found.</p>}
      <div className="space-y-4">
        {projects.map(p => (
          <div key={p.freelancer_id} className="bg-white border rounded-lg p-5 flex items-center justify-between">
            <div>
              <Link to={`/client/projects/${p.freelancer_id}`} className="font-semibold text-gray-900 hover:text-blue-600">
                {p.title}
              </Link>
              <div className="text-sm text-gray-500 mt-1">
                {p.bid_count} bids · ${p.budget_range.min}–${p.budget_range.max} {p.budget_range.currency}
              </div>
            </div>
            <button
              onClick={() => handleAnalyze(p.freelancer_id)}
              disabled={analyzing === p.freelancer_id || p.bid_count === 0}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {analyzing === p.freelancer_id ? 'Queuing...' : 'Analyze Bids'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: ClientAnalysis page**

```tsx
// frontend/src/pages/client/ClientAnalysis.tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchAnalysis } from '../../api/client';
import type { ClientAnalysisResult, BidShortlistItem } from '../../types/api';

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? 'bg-green-100 text-green-800' : score >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800';
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>{score}/100</span>;
}

function BidCard({ item }: { item: BidShortlistItem }) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-gray-400">#{item.rank}</span>
          <span className="font-semibold text-gray-900">{item.bidder_name}</span>
          <ScoreBadge score={item.score} />
        </div>
        <span className="font-semibold text-gray-900">${item.bid_amount}</span>
      </div>
      <p className="text-gray-600 text-sm mb-3">{item.summary}</p>
      {item.strengths.length > 0 && (
        <div className="mb-2">
          <span className="text-xs font-medium text-green-700 uppercase">Strengths</span>
          <ul className="mt-1 space-y-0.5">
            {item.strengths.map((s, i) => <li key={i} className="text-sm text-gray-600">+ {s}</li>)}
          </ul>
        </div>
      )}
      {item.concerns.length > 0 && (
        <div>
          <span className="text-xs font-medium text-red-700 uppercase">Concerns</span>
          <ul className="mt-1 space-y-0.5">
            {item.concerns.map((c, i) => <li key={i} className="text-sm text-gray-600">- {c}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ClientAnalysis() {
  const { id } = useParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<ClientAnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchAnalysis(id).then(r => setAnalysis(r.data.analysis)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-gray-500">Loading analysis...</div>;
  if (!analysis) return <div className="text-gray-500">Analysis not found.</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Bid Analysis</h1>
      <p className="text-gray-500 mb-6">Top {analysis.shortlist.length} recommended bids</p>
      <div className="space-y-4">
        {analysis.shortlist.map(item => <BidCard key={item.rank} item={item} />)}
      </div>
    </div>
  );
}
```

**Step 4: ClientProjectDetail (stub — shows bids + link to analysis)**

```tsx
// frontend/src/pages/client/ClientProjectDetail.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchClientProjects, analyzeClientBids } from '../../api/client';
import type { ClientProject } from '../../types/api';

export default function ClientProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ClientProject | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [queued, setQueued] = useState(false);

  useEffect(() => {
    fetchClientProjects().then(r => {
      const p = r.data.projects.find(p => p.freelancer_id === id);
      setProject(p || null);
    });
  }, [id]);

  const handleAnalyze = async () => {
    if (!id) return;
    setAnalyzing(true);
    await analyzeClientBids(id);
    setAnalyzing(false);
    setQueued(true);
  };

  if (!project) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{project.title}</h1>
      <p className="text-gray-600 mb-4">{project.description}</p>
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
        <span>{project.bid_count} bids received</span>
        <span>Budget: ${project.budget_range.min}–${project.budget_range.max} {project.budget_range.currency}</span>
      </div>
      {queued
        ? <div className="p-4 bg-green-50 text-green-700 rounded-lg">Analysis queued — check back shortly.</div>
        : (
          <button
            onClick={handleAnalyze}
            disabled={analyzing || project.bid_count === 0}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {analyzing ? 'Queuing...' : 'Analyze Bids'}
          </button>
        )
      }
    </div>
  );
}
```

**Commit:**

```bash
git add frontend/src/pages/client/ frontend/src/types/api.ts
git commit -m "feat: add client dashboard pages (projects, project detail, analysis)"
```

---

### Task 16: Frontend — Admin Pages

**Files:**
- Create: `frontend/src/pages/admin/AdminUsers.tsx`
- Create: `frontend/src/pages/admin/AdminStats.tsx`

**Step 1: AdminUsers**

```tsx
// frontend/src/pages/admin/AdminUsers.tsx
import { useEffect, useState } from 'react';
import { fetchAdminUsers, updateUserRole } from '../../api/client';
import type { AdminUser } from '../../types/api';

const ROLES = ['freelancer', 'client', 'super_admin'];

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminUsers().then(r => setUsers(r.data.users)).finally(() => setLoading(false));
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    await updateUserRole(userId, newRole);
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  if (loading) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Users ({users.length})</h1>
      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Name', 'Email', 'Role', 'Joined'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={e => handleRoleChange(u.id, e.target.value)}
                    className="text-sm border rounded px-2 py-1"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: AdminStats**

```tsx
// frontend/src/pages/admin/AdminStats.tsx
import { useEffect, useState } from 'react';
import { fetchAdminStats } from '../../api/client';
import type { AdminStats } from '../../types/api';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border rounded-lg p-5">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function AdminStats() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    fetchAdminStats().then(r => setStats(r.data.stats));
  }, []);

  if (!stats) return <div className="text-gray-500">Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Platform Stats</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={stats.users.total} />
        <StatCard label="Freelancers" value={stats.users.freelancers} />
        <StatCard label="Clients" value={stats.users.clients} />
        <StatCard label="Bid Analyses Run" value={stats.analyses.total} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Projects by Status</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Object.entries(stats.projects.by_status).map(([status, count]) => (
            <StatCard key={status} label={status.replace('_', ' ')} value={count} />
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Commit:**

```bash
git add frontend/src/pages/admin/
git commit -m "feat: add admin dashboard pages (users, stats)"
```

---

### Task 17: Run Full Test Suite + Final Verification

**Step 1: Run all backend specs**

```bash
bundle exec rspec
```
Expected: all pass, 0 failures

**Step 2: Build frontend**

```bash
cd frontend && npm run build
```
Expected: build succeeds with no TypeScript errors

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: resolve any remaining test or build issues"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | User model (MongoDB) with role + OAuth fields |
| 2 | Auth::TokenService — JWT encode/decode |
| 3 | Auth::FreelancerOAuth — manual OAuth2 flow using Faraday |
| 4 | Auth controller + routes (authorize + callback endpoints) |
| 5 | JWT middleware in ApplicationController + retrofit existing specs |
| 6 | ClientAnalysis model |
| 7 | ClientPortal::FreelancerClient — fetch client's projects + bids |
| 8 | ClientPortal::BidAnalyzer — Claude prompt + Bedrock analysis |
| 9 | ClientPortal::AnalyzeBidsJob — Sidekiq job |
| 10 | Client API controllers (projects, analyses) |
| 11 | Admin API controllers (users, stats) |
| 12 | Frontend: AuthContext, axios interceptor, OAuth callback page |
| 13 | Frontend: Login page |
| 14 | Frontend: App.tsx refactor with protected routes |
| 15 | Frontend: Client dashboard pages |
| 16 | Frontend: Admin pages |
| 17 | Full test suite run + build verification |
