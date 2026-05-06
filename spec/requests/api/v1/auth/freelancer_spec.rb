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
