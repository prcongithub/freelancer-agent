# Super Admin Password Login Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the super_admin user to log in with email + password (bypassing Freelancer.com OAuth) while all other roles continue using OAuth.

**Architecture:** Add `password_digest` to the User model using `has_secure_password` (bcrypt already in Gemfile). Super admin users use `provider: "local"` and `provider_uid: email`. A new `POST /api/v1/auth/sessions` endpoint authenticates and issues a JWT. A rake task creates/updates the super admin user from the CLI. Frontend gets a togglable admin login form on the Login page.

**Tech Stack:** Rails 8, Mongoid 9, bcrypt (~> 3.1.7), JWT (existing `Auth::TokenService`), React + TypeScript, Axios

---

### Task 1: Update User model for password auth

**Files:**
- Modify: `app/models/user.rb`
- Test: `spec/models/user_spec.rb`

**Context:** `bcrypt` is already in the Gemfile. The User model uses Mongoid (not ActiveRecord). `has_secure_password` comes from `ActiveModel::SecurePassword` which Mongoid supports. Super admin users use `provider: "local"` and `provider_uid: email` so existing uniqueness index still works. `password` virtual attribute is added by `has_secure_password`; `password_digest` must be declared as a Mongoid field.

**Step 1: Write the failing tests**

File: `spec/models/user_spec.rb`

```ruby
require "rails_helper"

RSpec.describe User, type: :model do
  describe "local (super_admin) user" do
    subject(:user) do
      User.new(
        provider:     "local",
        provider_uid: "admin@example.com",
        role:         "super_admin",
        name:         "Admin",
        email:        "admin@example.com",
        password:     "securepass123"
      )
    end

    it "is valid with email and password" do
      expect(user).to be_valid
    end

    it "authenticates with correct password" do
      user.save!
      expect(user.authenticate("securepass123")).to eq(user)
    end

    it "rejects wrong password" do
      user.save!
      expect(user.authenticate("wrongpass")).to be_falsey
    end

    it "is invalid without password on create" do
      user.password = nil
      expect(user).not_to be_valid
    end
  end
end
```

**Step 2: Run test to verify it fails**

```bash
bundle exec rspec spec/models/user_spec.rb -f doc
```

Expected: FAIL — `undefined method 'authenticate'` or similar.

**Step 3: Update User model**

File: `app/models/user.rb` — add `password_digest` field and `has_secure_password`:

```ruby
class User
  include Mongoid::Document
  include Mongoid::Timestamps
  include ActiveModel::SecurePassword

  ROLES = %w[freelancer client super_admin].freeze

  field :provider,            type: String
  field :provider_uid,        type: String
  field :oauth_token,         type: String
  field :oauth_token_secret,  type: String
  field :role,                type: String
  field :name,                type: String
  field :email,               type: String
  field :avatar_url,          type: String
  field :password_digest,     type: String

  has_secure_password validations: false

  validates :provider,     presence: true
  validates :provider_uid, presence: true, uniqueness: { scope: :provider }
  validates :role,         presence: true, inclusion: { in: ROLES }
  validates :name,         presence: true
  validates :email,        format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :password,     presence: true, length: { minimum: 8 }, if: :local?

  index({ provider: 1, provider_uid: 1 }, { unique: true })
  index({ role: 1 })
  index({ email: 1 })

  def local?
    provider == "local"
  end
end
```

**Step 4: Run tests to verify they pass**

```bash
bundle exec rspec spec/models/user_spec.rb -f doc
```

Expected: 4 examples, 0 failures.

**Step 5: Commit**

```bash
git add app/models/user.rb spec/models/user_spec.rb
git commit -m "feat: add password_digest and has_secure_password to User for local auth"
```

---

### Task 2: Sessions controller (password login endpoint)

**Files:**
- Create: `app/controllers/api/v1/auth/sessions_controller.rb` — NOTE: this file already exists as a JWT refresh (`me` action). Add the `create` action to the existing file.
- Test: `spec/requests/api/v1/auth/sessions_spec.rb`

**Context:** `POST /api/v1/auth/sessions` accepts `{ email, password }`. Finds user by `provider: "local"` and `email`. Calls `user.authenticate(password)`. Returns JWT on success, 401 on failure. The controller skips `authenticate_user!` (public endpoint). The existing `get "me"` action in this file must be preserved.

**Step 1: Check existing sessions controller**

Read `app/controllers/api/v1/auth/sessions_controller.rb` to see the current `me` action before editing.

**Step 2: Write the failing tests**

File: `spec/requests/api/v1/auth/sessions_spec.rb`

```ruby
require "rails_helper"

RSpec.describe "POST /api/v1/auth/sessions", type: :request do
  let!(:admin) do
    User.create!(
      provider:     "local",
      provider_uid: "admin@prolanceai.com",
      role:         "super_admin",
      name:         "Admin",
      email:        "admin@prolanceai.com",
      password:     "securepass123"
    )
  end

  context "with valid credentials" do
    it "returns a JWT token and user info" do
      post "/api/v1/auth/sessions", params: { email: "admin@prolanceai.com", password: "securepass123" }, as: :json
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["token"]).to be_present
      expect(json["role"]).to eq("super_admin")
      # verify it's a valid JWT
      payload = Auth::TokenService.decode(json["token"])
      expect(payload["role"]).to eq("super_admin")
    end
  end

  context "with wrong password" do
    it "returns 401" do
      post "/api/v1/auth/sessions", params: { email: "admin@prolanceai.com", password: "wrongpass" }, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(JSON.parse(response.body)["error"]).to eq("Invalid email or password")
    end
  end

  context "with unknown email" do
    it "returns 401" do
      post "/api/v1/auth/sessions", params: { email: "nobody@example.com", password: "anything" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  context "with non-local user email" do
    it "returns 401 (OAuth users cannot use password login)" do
      User.create!(
        provider: "freelancer", provider_uid: "fl_123",
        role: "freelancer", name: "Jane", email: "jane@example.com",
        oauth_token: "tok"
      )
      post "/api/v1/auth/sessions", params: { email: "jane@example.com", password: "anything" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
```

**Step 3: Run tests to verify they fail**

```bash
bundle exec rspec spec/requests/api/v1/auth/sessions_spec.rb -f doc
```

Expected: FAIL — routing error or 404.

**Step 4: Add `create` action to existing sessions controller**

File: `app/controllers/api/v1/auth/sessions_controller.rb`

Read the file first, then add the `create` action. The full file should look like:

```ruby
module Api
  module V1
    module Auth
      class SessionsController < ApplicationController
        skip_before_action :authenticate_user!, raise: false

        # POST /api/v1/auth/sessions — password login (super_admin only)
        def create
          user = User.find_by(provider: "local", email: params[:email].to_s.downcase.strip)
          if user&.authenticate(params[:password])
            token = ::Auth::TokenService.encode(user_id: user.id.to_s, role: user.role)
            render json: { token: token, role: user.role, name: user.name }
          else
            render json: { error: "Invalid email or password" }, status: :unauthorized
          end
        end

        # GET /api/v1/auth/me — refresh JWT from DB role
        def me
          render json: {
            token: ::Auth::TokenService.encode(user_id: current_user.id.to_s, role: current_user.role),
            role:  current_user.role,
            name:  current_user.name
          }
        end
      end
    end
  end
end
```

**Step 5: Run tests to verify they pass**

```bash
bundle exec rspec spec/requests/api/v1/auth/sessions_spec.rb -f doc
```

Expected: 4 examples, 0 failures.

**Step 6: Commit**

```bash
git add app/controllers/api/v1/auth/sessions_controller.rb spec/requests/api/v1/auth/sessions_spec.rb
git commit -m "feat: add password login endpoint POST /api/v1/auth/sessions"
```

---

### Task 3: Add route for sessions#create

**Files:**
- Modify: `config/routes.rb`

**Context:** The `auth` namespace already has `get "me"` pointing to `sessions#me`. Add `post "sessions"` in the same namespace. No test needed — the sessions spec from Task 2 will cover routing.

**Step 1: Update routes**

File: `config/routes.rb` — find the auth namespace block and add the sessions route:

```ruby
namespace :auth do
  get  "freelancer/authorize", to: "freelancer#authorize"
  get  "freelancer/callback",  to: "freelancer#callback"
  get  "me",                   to: "sessions#me"
  post "sessions",             to: "sessions#create"   # ← add this line
end
```

**Step 2: Verify route exists**

```bash
bundle exec rails routes | grep "sessions"
```

Expected output includes:
```
POST  /api/v1/auth/sessions  api/v1/auth/sessions#create
```

**Step 3: Run full sessions spec to confirm routing works**

```bash
bundle exec rspec spec/requests/api/v1/auth/sessions_spec.rb -f doc
```

Expected: 4 examples, 0 failures.

**Step 4: Commit**

```bash
git add config/routes.rb
git commit -m "feat: add POST /api/v1/auth/sessions route"
```

---

### Task 4: Rake task to create/update super admin

**Files:**
- Create: `lib/tasks/admin.rake`

**Context:** This rake task lets the operator create or update the super_admin user from the CLI without touching MongoDB directly. Usage: `rake admin:create EMAIL=admin@prolanceai.com PASSWORD=securepass123 NAME="Admin"`. If user with that email already exists as local, update password. If not, create.

**Step 1: Create the rake task**

File: `lib/tasks/admin.rake`

```ruby
namespace :admin do
  desc "Create or update super_admin user. Usage: rake admin:create EMAIL=... PASSWORD=... NAME=..."
  task create: :environment do
    email    = ENV.fetch("EMAIL")    { abort "EMAIL is required. Usage: rake admin:create EMAIL=... PASSWORD=... NAME=..." }
    password = ENV.fetch("PASSWORD") { abort "PASSWORD is required." }
    name     = ENV.fetch("NAME", "Super Admin")

    user = User.find_or_initialize_by(provider: "local", provider_uid: email.downcase.strip)
    user.assign_attributes(
      role:         "super_admin",
      name:         name,
      email:        email.downcase.strip,
      password:     password
    )
    if user.save
      puts "✓ Super admin #{user.new_record? ? 'created' : 'updated'}: #{email}"
    else
      puts "✗ Failed: #{user.errors.full_messages.join(', ')}"
      exit 1
    end
  end
end
```

**Step 2: Test the rake task manually**

```bash
bundle exec rake admin:create EMAIL=admin@prolanceai.com PASSWORD=SecurePass123! NAME="ProLanceAI Admin"
```

Expected output:
```
✓ Super admin created: admin@prolanceai.com
```

Run it again to test update:
```bash
bundle exec rake admin:create EMAIL=admin@prolanceai.com PASSWORD=NewPassword456! NAME="ProLanceAI Admin"
```

Expected:
```
✓ Super admin updated: admin@prolanceai.com
```

**Step 3: Commit**

```bash
git add lib/tasks/admin.rake
git commit -m "feat: add rake admin:create task to create/update super_admin user"
```

---

### Task 5: Frontend — admin login form on Login page

**Files:**
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/api/client.ts`

**Context:** Add a small "Admin login" toggle below the two OAuth buttons. Clicking it shows an email + password form. On submit, POST to `/api/v1/auth/sessions`, store the JWT via `login()` from `useAuth`, then redirect to `/admin/users`. On error, show inline error message. Keep the existing OAuth buttons unchanged.

**Step 1: Add `adminLogin` to api/client.ts**

File: `frontend/src/api/client.ts` — add after the existing `getOAuthUrl` export:

```typescript
export const adminLogin = (email: string, password: string) =>
  api.post<{ token: string; role: string; name: string }>('/auth/sessions', { email, password });
```

**Step 2: Update Login.tsx**

File: `frontend/src/pages/Login.tsx` — full replacement:

```tsx
import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getOAuthUrl, adminLogin } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const [loading, setLoading] = useState<'freelancer' | 'client' | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [params] = useSearchParams();
  const error = params.get('error');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (role: 'freelancer' | 'client') => {
    setLoading(role);
    try {
      const { data } = await getOAuthUrl(role);
      window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError('');
    setAdminLoading(true);
    try {
      const { data } = await adminLogin(adminEmail, adminPassword);
      login(data.token);
      navigate('/admin/users', { replace: true });
    } catch {
      setAdminError('Invalid email or password');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-sm border p-10 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ProLanceAI</h1>
        <p className="text-gray-500 mb-8">Connect your Freelancer.com account to get started</p>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            Login failed. Please try again.
          </div>
        )}

        {!showAdmin ? (
          <>
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
            <button
              onClick={() => setShowAdmin(true)}
              className="mt-6 text-xs text-gray-400 hover:text-gray-600"
            >
              Admin login
            </button>
          </>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-3 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={e => setAdminEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {adminError && (
              <p className="text-sm text-red-600">{adminError}</p>
            )}
            <button
              type="submit"
              disabled={adminLoading}
              className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50"
            >
              {adminLoading ? 'Logging in...' : 'Login as Admin'}
            </button>
            <button
              type="button"
              onClick={() => { setShowAdmin(false); setAdminError(''); }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 pt-1"
            >
              Back
            </button>
          </form>
        )}

        <p className="mt-6 text-xs text-gray-400">
          You will be redirected to Freelancer.com to authorize access
        </p>
      </div>
    </div>
  );
}
```

**Step 3: Verify frontend builds**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: clean build, no TypeScript errors.

**Step 4: Commit**

```bash
git add frontend/src/pages/Login.tsx frontend/src/api/client.ts
git commit -m "feat: add admin login form to Login page"
```

---

### Task 6: Run full test suite and verify

**Step 1: Run all backend specs**

```bash
bundle exec rspec --format progress 2>&1 | tail -5
```

Expected: all examples pass, 0 failures.

**Step 2: Run frontend build**

```bash
cd frontend && npm run build 2>&1 | tail -5
```

Expected: clean build.

**Step 3: Create super admin and test login manually**

```bash
# In Docker
docker compose exec api bundle exec rake admin:create EMAIL=admin@prolanceai.com PASSWORD=SecurePass123! NAME="ProLanceAI Admin"
```

Then visit `http://localhost:5173`, click **Admin login**, enter the credentials, and confirm redirect to `/admin/users`.

**Step 4: Commit if any fixes needed, then final commit**

```bash
git add -p
git commit -m "fix: <describe any fixes>"
```
