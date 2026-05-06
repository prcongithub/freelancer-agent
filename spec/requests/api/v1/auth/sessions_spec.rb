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
