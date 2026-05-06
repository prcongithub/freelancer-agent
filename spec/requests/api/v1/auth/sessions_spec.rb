require "rails_helper"

RSpec.describe "Api::V1::Auth::Sessions", type: :request do
  describe "GET /api/v1/auth/me" do
    it "returns a fresh JWT for the authenticated user" do
      user = FactoryBot.create(:user, :client)
      headers = jwt_headers(role: "client", user_id: user.id.to_s)

      get "/api/v1/auth/me", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["token"]).to be_present
      payload = Auth::TokenService.decode(json["token"])
      expect(payload["role"]).to eq("client")
      expect(json["user"]["role"]).to eq("client")
    end

    it "returns 401 without auth" do
      get "/api/v1/auth/me"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end

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
