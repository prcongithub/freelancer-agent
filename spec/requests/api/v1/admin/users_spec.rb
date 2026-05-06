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

    it "returns 401 without auth" do
      get "/api/v1/admin/users"
      expect(response).to have_http_status(:unauthorized)
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
