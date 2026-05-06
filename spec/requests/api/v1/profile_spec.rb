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
