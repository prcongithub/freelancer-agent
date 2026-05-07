# Email/Password Registration & Freelancer API Token Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow freelancers and clients to register with email + password, then connect their Freelancer.com account by pasting their personal API token — enabling full platform functionality without OAuth.

**Architecture:** Extend the existing `provider: "local"` user pattern (already used by super_admin) to all roles. Add a registration endpoint, a profile update endpoint for storing the Freelancer.com API token + user ID, and update `SubmitBidJob` to use the submitting user's token instead of the global ENV token. Scanner continues to use the global ENV token (it searches globally, not per-user). Frontend gets a registration form on the login page and a Freelancer Connection section in Settings.

**Tech Stack:** Rails 8, Mongoid 9, bcrypt (existing), JWT (existing), React + TypeScript, Axios

---

### Task 1: Add `freelancer_user_id` to User model

**Files:**
- Modify: `app/models/user.rb`
- Modify: `spec/models/user_spec.rb`

**Context:** The `oauth_token` field stores the Freelancer.com API token. We need a separate `freelancer_user_id` field for the numeric Freelancer.com user ID (used in bid submission). `SubmitBidJob` currently hardcodes `ENV.fetch("FREELANCER_USER_ID")` — this needs to be per-user.

**Step 1: Write a failing test**

Add to `spec/models/user_spec.rb` inside the existing file, after the existing describe block:

```ruby
describe "freelancer_user_id field" do
  it "stores and retrieves freelancer_user_id" do
    user = User.new(
      provider: "local", provider_uid: "test@example.com",
      role: "freelancer", name: "Test", email: "test@example.com",
      password: "password123", freelancer_user_id: "2870829"
    )
    expect(user.freelancer_user_id).to eq("2870829")
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/models/user_spec.rb -f doc
```

Expected: FAIL — unknown attribute `freelancer_user_id`

**Step 3: Add field to User model**

In `app/models/user.rb`, add after `field :avatar_url`:

```ruby
field :freelancer_user_id, type: String
```

**Step 4: Run to verify it passes**

```bash
bundle exec rspec spec/models/user_spec.rb -f doc
```

Expected: all examples pass.

**Step 5: Commit**

```bash
git add app/models/user.rb spec/models/user_spec.rb
git commit -m "feat: add freelancer_user_id field to User model"
```

---

### Task 2: Registration controller + route

**Files:**
- Create: `app/controllers/api/v1/auth/registrations_controller.rb`
- Modify: `config/routes.rb`
- Create: `spec/requests/api/v1/auth/registrations_spec.rb`

**Context:** `POST /api/v1/auth/registrations` accepts `{ email, password, password_confirmation, role }`. Role must be `freelancer` or `client` (not super_admin — that's set manually). Uses `provider: "local"`, `provider_uid: email.downcase`. Returns JWT on success. Skips auth (public endpoint). Validates role explicitly in the controller (not just model).

**Step 1: Write failing tests**

File: `spec/requests/api/v1/auth/registrations_spec.rb`

```ruby
require "rails_helper"

RSpec.describe "POST /api/v1/auth/registrations", type: :request do
  let(:valid_params) do
    { email: "jane@example.com", password: "password123", password_confirmation: "password123", role: "freelancer" }
  end

  context "with valid params" do
    it "creates a user and returns a JWT" do
      expect {
        post "/api/v1/auth/registrations", params: valid_params, as: :json
      }.to change(User, :count).by(1)

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["token"]).to be_present
      expect(json["role"]).to eq("freelancer")

      payload = Auth::TokenService.decode(json["token"])
      expect(payload["role"]).to eq("freelancer")
    end

    it "creates user with provider: local" do
      post "/api/v1/auth/registrations", params: valid_params, as: :json
      user = User.find_by(email: "jane@example.com")
      expect(user.provider).to eq("local")
      expect(user.provider_uid).to eq("jane@example.com")
    end
  end

  context "with invalid role" do
    it "rejects super_admin role" do
      post "/api/v1/auth/registrations",
           params: valid_params.merge(role: "super_admin"), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  context "with mismatched passwords" do
    it "returns 422" do
      post "/api/v1/auth/registrations",
           params: valid_params.merge(password_confirmation: "wrong"), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  context "with duplicate email" do
    it "returns 422" do
      User.create!(provider: "local", provider_uid: "jane@example.com",
                   role: "freelancer", name: "Jane", email: "jane@example.com",
                   password: "password123")
      post "/api/v1/auth/registrations", params: valid_params, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  context "with client role" do
    it "creates a client user" do
      post "/api/v1/auth/registrations",
           params: valid_params.merge(role: "client"), as: :json
      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body)["role"]).to eq("client")
    end
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/requests/api/v1/auth/registrations_spec.rb -f doc
```

Expected: routing error / 404.

**Step 3: Create registrations controller**

File: `app/controllers/api/v1/auth/registrations_controller.rb`

```ruby
module Api
  module V1
    module Auth
      class RegistrationsController < ApplicationController
        skip_before_action :authenticate_user!, raise: false

        def create
          unless %w[freelancer client].include?(params[:role])
            render json: { error: "Role must be freelancer or client" }, status: :unprocessable_entity
            return
          end

          unless params[:password] == params[:password_confirmation]
            render json: { error: "Passwords do not match" }, status: :unprocessable_entity
            return
          end

          email = params[:email].to_s.downcase.strip
          user  = User.new(
            provider:     "local",
            provider_uid: email,
            role:         params[:role],
            name:         params[:name].presence || email.split("@").first.capitalize,
            email:        email,
            password:     params[:password]
          )

          if user.save
            token = ::Auth::TokenService.encode(user_id: user.id.to_s, role: user.role)
            render json: { token: token, role: user.role, name: user.name }, status: :created
          else
            render json: { error: user.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        end
      end
    end
  end
end
```

**Step 4: Add route**

In `config/routes.rb`, inside `namespace :auth`:

```ruby
post "registrations", to: "registrations#create"
```

**Step 5: Run tests**

```bash
bundle exec rspec spec/requests/api/v1/auth/registrations_spec.rb -f doc
```

Expected: 5 examples, 0 failures.

**Step 6: Commit**

```bash
git add app/controllers/api/v1/auth/registrations_controller.rb config/routes.rb spec/requests/api/v1/auth/registrations_spec.rb
git commit -m "feat: add POST /api/v1/auth/registrations endpoint"
```

---

### Task 3: Profile update endpoint (PATCH /api/v1/profile)

**Files:**
- Create: `app/controllers/api/v1/profile_controller.rb`
- Modify: `config/routes.rb`
- Create: `spec/requests/api/v1/profile_spec.rb`

**Context:** Allows authenticated users to update their `oauth_token` (Freelancer.com API token) and `freelancer_user_id`. Also returns current profile (GET). Protected — requires valid JWT. Any role can use it.

**Step 1: Write failing tests**

File: `spec/requests/api/v1/profile_spec.rb`

```ruby
require "rails_helper"

RSpec.describe "Profile", type: :request do
  let!(:user) do
    User.create!(
      provider: "local", provider_uid: "dev@example.com",
      role: "freelancer", name: "Dev", email: "dev@example.com",
      password: "password123"
    )
  end
  let(:headers) { jwt_headers(role: "freelancer", user_id: user.id.to_s) }

  describe "GET /api/v1/profile" do
    it "returns current user profile" do
      get "/api/v1/profile", headers: headers
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["profile"]["email"]).to eq("dev@example.com")
      expect(json["profile"]["role"]).to eq("freelancer")
    end
  end

  describe "PATCH /api/v1/profile" do
    it "updates oauth_token and freelancer_user_id" do
      patch "/api/v1/profile",
            params: { oauth_token: "mytoken123", freelancer_user_id: "12345" },
            headers: headers, as: :json

      expect(response).to have_http_status(:ok)
      user.reload
      expect(user.oauth_token).to eq("mytoken123")
      expect(user.freelancer_user_id).to eq("12345")
    end

    it "returns 401 without token" do
      patch "/api/v1/profile", params: { oauth_token: "x" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
```

**Step 2: Run to verify it fails**

```bash
bundle exec rspec spec/requests/api/v1/profile_spec.rb -f doc
```

Expected: routing error / 404.

**Step 3: Create profile controller**

File: `app/controllers/api/v1/profile_controller.rb`

```ruby
module Api
  module V1
    class ProfileController < ApplicationController
      def show
        render json: { profile: serialize_profile(current_user) }
      end

      def update
        allowed = params.permit(:oauth_token, :freelancer_user_id, :name)
        if current_user.update(allowed)
          render json: { profile: serialize_profile(current_user) }
        else
          render json: { error: current_user.errors.full_messages.join(", ") },
                 status: :unprocessable_entity
        end
      end

      private

      def serialize_profile(user)
        {
          id:                  user.id.to_s,
          name:                user.name,
          email:               user.email,
          role:                user.role,
          freelancer_user_id:  user.freelancer_user_id,
          has_api_token:       user.oauth_token.present?
        }
      end
    end
  end
end
```

**Step 4: Add routes**

In `config/routes.rb`, inside `namespace :v1` (alongside other top-level resources):

```ruby
resource :profile, only: [:show, :update]
```

**Step 5: Run tests**

```bash
bundle exec rspec spec/requests/api/v1/profile_spec.rb -f doc
```

Expected: 3 examples, 0 failures.

**Step 6: Commit**

```bash
git add app/controllers/api/v1/profile_controller.rb config/routes.rb spec/requests/api/v1/profile_spec.rb
git commit -m "feat: add GET/PATCH /api/v1/profile for Freelancer API token management"
```

---

### Task 4: SubmitBidJob — use per-user token

**Files:**
- Modify: `app/modules/bidder/submit_bid_job.rb`
- Modify: `app/controllers/api/v1/projects_controller.rb`
- Modify: `spec/modules/bidder/submit_bid_job_spec.rb` (if it exists — check first)

**Context:** `SubmitBidJob#perform` currently uses `ENV.fetch("FREELANCER_API_TOKEN")` and `ENV.fetch("FREELANCER_USER_ID")`. Add an optional `user_id` second argument. If provided, look up the user and use their `oauth_token` and `freelancer_user_id`. Fall back to ENV values if user not found or fields are blank. `ProjectsController#approve_bid` passes `@current_user_id` to the job.

**Step 1: Check for existing spec**

```bash
ls spec/modules/bidder/
```

**Step 2: Update `SubmitBidJob#perform`**

In `app/modules/bidder/submit_bid_job.rb`, change:

```ruby
def perform(project_id)
```

to:

```ruby
def perform(project_id, user_id = nil)
  user = user_id ? User.find(user_id) : nil
rescue Mongoid::Errors::DocumentNotFound
  user = nil
ensure
```

Wait — `rescue` in a method must wrap the right code. The correct implementation:

Replace the entire `perform` method signature and add user lookup at the top:

```ruby
def perform(project_id, user_id = nil)
  project = Project.find(project_id)
  return unless project.status == "discovered"

  @bid_user = resolve_user(user_id)

  # ... rest unchanged ...
end
```

And change `submit_to_freelancer` to use instance variables.

The full updated `app/modules/bidder/submit_bid_job.rb`:

```ruby
module Bidder
  class SubmitBidJob
    include Sidekiq::Job
    sidekiq_options queue: :bidding, retry: 3

    def perform(project_id, user_id = nil)
      project = Project.find(project_id)
      return unless project.status == "discovered"

      @bid_user = resolve_user(user_id)

      existing_bid = Bid.where(project_id: project.id).first
      if existing_bid
        if existing_bid.freelancer_bid_id.present?
          project.set(status: "bid_sent", bid_at: Time.current)
          return
        end
        submit_to_freelancer(project, existing_bid)
        project.set(status: "bid_sent", bid_at: Time.current)
        return
      end

      pricing_engine     = PricingEngine.new
      proposal_generator = ProposalGenerator.new

      approved_proto = Prototype.by_project(project.id).approved.first

      project_data = {
        title:           project.title,
        description:     project.description,
        category:        project.category,
        budget_range:    project.budget_range&.transform_keys(&:to_sym) || {},
        skills_required: project.skills_required,
        fit_score:       project.fit_score&.transform_keys(&:to_sym) || {},
        analysis:        project.analysis,
        prototype_url:   approved_proto&.public_url
      }

      pricing  = pricing_engine.calculate(project_data)
      proposal = proposal_generator.generate(project_data)

      bid = Bid.create!(
        project:           project,
        amount:            pricing[:amount],
        currency:          pricing[:currency] || "USD",
        proposal_text:     proposal,
        pricing_breakdown: pricing,
        status:            "submitted",
        submitted_at:      Time.current
      )

      submit_to_freelancer(project, bid)
      project.update!(status: "bid_sent", bid_at: Time.current)
    rescue Mongoid::Errors::DocumentNotFound
      Rails.logger.error("SubmitBidJob: Project #{project_id} not found")
    end

    private

    def resolve_user(user_id)
      return nil unless user_id
      User.find(user_id)
    rescue Mongoid::Errors::DocumentNotFound
      nil
    end

    def api_token
      @bid_user&.oauth_token.presence || ENV.fetch("FREELANCER_API_TOKEN", "")
    end

    def freelancer_user_id
      @bid_user&.freelancer_user_id.presence || ENV.fetch("FREELANCER_USER_ID", "")
    end

    def submit_to_freelancer(project, bid)
      conn = Faraday.new(url: ENV.fetch("FREELANCER_API_BASE_URL", "https://www.freelancer.com/api")) do |f|
        f.request :json
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = api_token
      end

      response = conn.post("projects/0.1/bids/") do |req|
        req.body = {
          project_id:           project.freelancer_id.to_i,
          bidder_id:            freelancer_user_id.to_i,
          amount:               bid.amount,
          period:               7,
          milestone_percentage: 100,
          description:          bid.proposal_text
        }
      end

      unless response.success?
        Rails.logger.error("SubmitBidJob: Freelancer API error #{response.status}: #{response.body}")
        raise "Freelancer API submission failed with status #{response.status}"
      end

      bid_id = response.body.dig("result", "id")
      bid.update!(freelancer_bid_id: bid_id.to_s) if bid_id
    rescue Faraday::ConnectionFailed, Faraday::TimeoutError => e
      Rails.logger.error("SubmitBidJob#submit_to_freelancer network error: #{e.message}")
      raise
    end
  end
end
```

**Step 3: Update ProjectsController to pass user_id**

In `app/controllers/api/v1/projects_controller.rb`, change:

```ruby
Bidder::SubmitBidJob.perform_async(params[:id].to_s)
```

to:

```ruby
Bidder::SubmitBidJob.perform_async(params[:id].to_s, @current_user_id)
```

**Step 4: Run full suite**

```bash
bundle exec rspec --format progress 2>&1 | tail -5
```

Expected: all pass.

**Step 5: Commit**

```bash
git add app/modules/bidder/submit_bid_job.rb app/controllers/api/v1/projects_controller.rb
git commit -m "feat: SubmitBidJob uses per-user Freelancer token with ENV fallback"
```

---

### Task 5: Rake task for creating freelancer/client users with API token

**Files:**
- Modify: `lib/tasks/admin.rake`

**Context:** Extend the existing admin rake file with a `user:create` task. Accepts EMAIL, PASSWORD, NAME, ROLE, TOKEN (Freelancer API token), FREELANCER_USER_ID. Used to create Prashant's account.

**Step 1: Add task to existing rake file**

Read `lib/tasks/admin.rake` first, then append a `user` namespace:

```ruby
namespace :user do
  desc "Create or update a freelancer/client user. Usage: rake user:create EMAIL=... PASSWORD=... NAME=... ROLE=freelancer TOKEN=... FREELANCER_USER_ID=..."
  task create: :environment do
    email              = ENV.fetch("EMAIL")    { abort "EMAIL is required." }
    password           = ENV.fetch("PASSWORD") { abort "PASSWORD is required." }
    name               = ENV.fetch("NAME", email.split("@").first.capitalize)
    role               = ENV.fetch("ROLE", "freelancer")
    token              = ENV.fetch("TOKEN", "")
    freelancer_user_id = ENV.fetch("FREELANCER_USER_ID", "")

    abort "ROLE must be freelancer or client" unless %w[freelancer client].include?(role)

    user = User.find_or_initialize_by(provider: "local", provider_uid: email.downcase.strip)
    user.assign_attributes(
      role:               role,
      name:               name,
      email:              email.downcase.strip,
      password:           password,
      oauth_token:        token.presence || user.oauth_token,
      freelancer_user_id: freelancer_user_id.presence || user.freelancer_user_id
    )

    if user.save
      action = user.previously_new_record? ? "created" : "updated"
      puts "User #{action}: #{email} (#{role})"
      puts "Freelancer token: #{token.present? ? 'set' : 'not set'}"
      puts "Freelancer user ID: #{freelancer_user_id.present? ? freelancer_user_id : 'not set'}"
    else
      puts "Failed: #{user.errors.full_messages.join(', ')}"
      exit 1
    end
  end
end
```

**Step 2: Test the task**

```bash
docker compose exec api bundle exec rake user:create \
  EMAIL=test@example.com \
  PASSWORD=TestPass123! \
  ROLE=freelancer \
  TOKEN=testtoken \
  FREELANCER_USER_ID=99999
```

Expected: `User created: test@example.com (freelancer)`

**Step 3: Create Prashant's account** using the ENV token

```bash
docker compose exec api bundle exec rake user:create \
  EMAIL=prashant.chaudhari89@gmail.com \
  PASSWORD=PitchSignal2026! \
  NAME="Prashant Chaudhari" \
  ROLE=freelancer \
  TOKEN=h7uef1NovdouhKl7aavoNJPPzuppvy \
  FREELANCER_USER_ID=2870829
```

Expected: `User created: prashant.chaudhari89@gmail.com (freelancer)`

**Step 4: Commit**

```bash
git add lib/tasks/admin.rake
git commit -m "feat: add rake user:create task for freelancer/client user creation with API token"
```

---

### Task 6: Frontend — registration form on Login page

**Files:**
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/api/client.ts`

**Context:** Read `frontend/src/pages/Login.tsx` first — it has a dark-themed design (slate-900 bg). Add a "Create account" toggle alongside the existing "Admin login" toggle. Registration form: name (optional), email, password, confirm password, role selector (Freelancer / Client radio buttons). On success, call `login(token)` and navigate by role. Keep all existing UI unchanged.

**Step 1: Add `registerUser` to api/client.ts**

Read `frontend/src/api/client.ts` first, then add after `adminLogin`:

```typescript
export const registerUser = (data: {
  email: string;
  password: string;
  password_confirmation: string;
  role: 'freelancer' | 'client';
  name?: string;
}) => api.post<{ token: string; role: string; name: string }>('/auth/registrations', data);
```

**Step 2: Add registration form to Login.tsx**

Read `frontend/src/pages/Login.tsx` first (it has been updated with a dark theme — preserve all styling).

Add the following state variables alongside existing state:

```tsx
const [showRegister, setShowRegister] = useState(false);
const [regName, setRegName] = useState('');
const [regEmail, setRegEmail] = useState('');
const [regPassword, setRegPassword] = useState('');
const [regConfirm, setRegConfirm] = useState('');
const [regRole, setRegRole] = useState<'freelancer' | 'client'>('freelancer');
const [regLoading, setRegLoading] = useState(false);
const [regError, setRegError] = useState('');
```

Add the import:
```tsx
import { getOAuthUrl, adminLogin, registerUser } from '../api/client';
```

Add the handler:
```tsx
const handleRegister = async (e: React.FormEvent) => {
  e.preventDefault();
  setRegError('');
  if (regPassword !== regConfirm) {
    setRegError('Passwords do not match');
    return;
  }
  setRegLoading(true);
  try {
    const { data } = await registerUser({
      email: regEmail,
      password: regPassword,
      password_confirmation: regConfirm,
      role: regRole,
      name: regName || undefined,
    });
    login(data.token);
    navigate(data.role === 'client' ? '/client/projects' : '/', { replace: true });
  } catch (err: any) {
    setRegError(err.response?.data?.error || 'Registration failed');
  } finally {
    setRegLoading(false);
  }
};
```

In the JSX, the main panel currently shows `{!showAdmin ? (...) : (...)}`. Change to a three-way: `{showRegister ? registerForm : !showAdmin ? mainPanel : adminForm}`.

The register form JSX to add (matches the existing dark theme):

```tsx
const registerForm = (
  <form onSubmit={handleRegister} className="space-y-4">
    <div className="text-sm font-semibold text-slate-200 mb-1">Create Account</div>

    {/* Role selector */}
    <div className="flex gap-2">
      {(['freelancer', 'client'] as const).map(r => (
        <button
          key={r}
          type="button"
          onClick={() => setRegRole(r)}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
            regRole === r
              ? 'bg-indigo-600 border-indigo-600 text-white'
              : 'bg-slate-900/40 border-slate-600 text-slate-400 hover:border-slate-400'
          }`}
        >
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>

    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">Name (optional)</label>
      <input
        type="text"
        value={regName}
        onChange={e => setRegName(e.target.value)}
        placeholder="Your name"
        className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
    </div>
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
      <input
        type="email"
        value={regEmail}
        onChange={e => setRegEmail(e.target.value)}
        required
        placeholder="you@company.com"
        className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
    </div>
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
      <input
        type="password"
        value={regPassword}
        onChange={e => setRegPassword(e.target.value)}
        required
        placeholder="••••••••"
        className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
    </div>
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">Confirm Password</label>
      <input
        type="password"
        value={regConfirm}
        onChange={e => setRegConfirm(e.target.value)}
        required
        placeholder="••••••••"
        className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
      />
    </div>
    {regError && <p className="text-xs text-red-400">{regError}</p>}
    <button
      type="submit"
      disabled={regLoading}
      className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
    >
      {regLoading ? (
        <span className="flex items-center justify-center gap-2">
          <span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" />
          Creating account…
        </span>
      ) : 'Create Account'}
    </button>
    <button
      type="button"
      onClick={() => { setShowRegister(false); setRegError(''); }}
      className="w-full text-xs text-slate-500 hover:text-slate-300 transition-colors py-1"
    >
      ← Back
    </button>
  </form>
);
```

Add a "Create account" button to the main panel (alongside "Admin login"):

```tsx
<div className="flex justify-center gap-4 mt-4">
  <button
    onClick={() => setShowRegister(true)}
    className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
  >
    Create account
  </button>
  <span className="text-slate-700 text-xs">·</span>
  <button
    onClick={() => setShowAdmin(true)}
    className="text-xs text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
  >
    Admin login
  </button>
</div>
```

**Step 3: Verify build**

```bash
cd /home/prashant/data/PRC/startup_ideas/freelancing-agent/frontend && npm run build 2>&1 | tail -5
```

Expected: clean build, 0 TypeScript errors.

**Step 4: Commit**

```bash
git add frontend/src/pages/Login.tsx frontend/src/api/client.ts
git commit -m "feat: add registration form to login page"
```

---

### Task 7: Frontend — Freelancer Connection section in Settings

**Files:**
- Modify: `frontend/src/pages/Settings.tsx`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/types/api.ts`

**Context:** Read each file before editing. Add `getProfile` and `updateProfile` to api/client.ts. Add `UserProfile` type to types/api.ts. Add a "Freelancer Connection" section to Settings.tsx — separate from the existing settings, with its own save button. Fields: Freelancer.com API Token (password input with show/hide toggle), Freelancer.com User ID. Shows a green "Connected" badge when token is set.

**Step 1: Add types to `frontend/src/types/api.ts`**

Read `types/api.ts` first, then append:

```typescript
export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  freelancer_user_id: string | null;
  has_api_token: boolean;
}
```

**Step 2: Add API functions to `frontend/src/api/client.ts`**

Read the file first, then add after `updateProfile`:

```typescript
export const getProfile = () =>
  api.get<{ profile: UserProfile }>('/profile');
export const updateProfile = (data: { oauth_token?: string; freelancer_user_id?: string; name?: string }) =>
  api.patch<{ profile: UserProfile }>('/profile', data);
```

**Step 3: Add Freelancer Connection section to Settings.tsx**

Read `frontend/src/pages/Settings.tsx` first.

Add these imports:
```tsx
import { fetchSettings, updateSettings, getProfile, updateProfile } from '../api/client';
import type { Settings, UserProfile } from '../types/api';
```

Add state variables after existing state:
```tsx
const [profile, setProfile] = useState<UserProfile | null>(null);
const [apiToken, setApiToken] = useState('');
const [flUserId, setFlUserId] = useState('');
const [showToken, setShowToken] = useState(false);
const [profileSaving, setProfileSaving] = useState(false);
const [profileSaved, setProfileSaved] = useState(false);
const [profileError, setProfileError] = useState<string | null>(null);
```

Add profile fetch to existing `useEffect`:
```tsx
useEffect(() => {
  Promise.all([fetchSettings(), getProfile()])
    .then(([settingsRes, profileRes]) => {
      setSettings(settingsRes.data.settings);
      setProfile(profileRes.data.profile);
      setFlUserId(profileRes.data.profile.freelancer_user_id || '');
    })
    .catch(() => setError('Failed to load settings'))
    .finally(() => setLoading(false));
}, []);
```

Add profile save handler:
```tsx
const handleProfileSave = async () => {
  setProfileError(null); setProfileSaving(true); setProfileSaved(false);
  try {
    const payload: { oauth_token?: string; freelancer_user_id?: string } = {
      freelancer_user_id: flUserId,
    };
    if (apiToken) payload.oauth_token = apiToken;
    const res = await updateProfile(payload);
    setProfile(res.data.profile);
    setApiToken('');
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 3000);
  } catch {
    setProfileError('Failed to save connection');
  } finally {
    setProfileSaving(false);
  }
};
```

Add the Freelancer Connection section JSX **before** the existing save row, after the Pricing Floors card:

```tsx
{/* Freelancer Connection */}
<div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
  <div className="flex items-center justify-between mb-5">
    <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Freelancer.com Connection</h2>
    {profile?.has_api_token && (
      <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
        ✓ Connected
      </span>
    )}
  </div>
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">API Token</label>
      <div className="relative">
        <input
          type={showToken ? 'text' : 'password'}
          value={apiToken}
          onChange={e => setApiToken(e.target.value)}
          placeholder={profile?.has_api_token ? '••••••••••••••• (token saved — paste to update)' : 'Paste your Freelancer.com API token'}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 pr-16 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <button
          type="button"
          onClick={() => setShowToken(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
        >
          {showToken ? 'Hide' : 'Show'}
        </button>
      </div>
      <p className="text-xs text-slate-400 mt-1">
        Get your token from <span className="font-mono">freelancer.com/settings/api</span>
      </p>
    </div>
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">Freelancer User ID</label>
      <input
        type="text"
        value={flUserId}
        onChange={e => setFlUserId(e.target.value)}
        placeholder="e.g. 2870829"
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 w-48 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      <p className="text-xs text-slate-400 mt-1">Your numeric user ID from your Freelancer.com profile URL.</p>
    </div>
  </div>
  {profileError && (
    <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
      {profileError}
    </div>
  )}
  <div className="flex items-center gap-4 mt-5">
    <button
      onClick={handleProfileSave}
      disabled={profileSaving}
      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50"
    >
      {profileSaving ? (
        <span className="flex items-center gap-2">
          <span className="animate-spin h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full" />
          Saving…
        </span>
      ) : 'Save Connection'}
    </button>
    {profileSaved && <span className="text-sm font-medium text-emerald-600">✓ Saved</span>}
  </div>
</div>
```

**Step 4: Verify build**

```bash
cd /home/prashant/data/PRC/startup_ideas/freelancing-agent/frontend && npm run build 2>&1 | tail -5
```

Expected: clean build, 0 TypeScript errors.

**Step 5: Commit**

```bash
git add frontend/src/pages/Settings.tsx frontend/src/api/client.ts frontend/src/types/api.ts
git commit -m "feat: add Freelancer Connection section to Settings page"
```

---

### Task 8: Run full test suite + final verification

**Step 1: Run all backend specs**

```bash
bundle exec rspec --format progress 2>&1 | tail -5
```

Expected: all examples, 0 failures.

**Step 2: Run frontend build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: clean build.

**Step 3: Verify Prashant's account works**

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/sessions \
  -H "Content-Type: application/json" \
  -d '{"email":"prashant.chaudhari89@gmail.com","password":"PitchSignal2026!"}' | python3 -m json.tool
```

Expected: `{ "token": "...", "role": "freelancer", "name": "Prashant Chaudhari" }`
