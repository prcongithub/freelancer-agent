# spec/requests/api/v1/admin/stats_spec.rb
require "rails_helper"

RSpec.describe "Api::V1::Admin::Stats", type: :request do
  describe "GET /api/v1/admin/stats" do
    it "returns platform stats for super_admin" do
      FactoryBot.create(:user, :client)
      FactoryBot.create(:user)

      get "/api/v1/admin/stats", headers: admin_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["stats"]["users"]["total"]).to eq(2)
      expect(json["stats"]["users"]["clients"]).to eq(1)
      expect(json["stats"]["users"]["freelancers"]).to eq(1)
      expect(json["stats"]).to have_key("projects")
      expect(json["stats"]).to have_key("analyses")
    end

    it "returns 403 for freelancer" do
      get "/api/v1/admin/stats", headers: freelancer_headers
      expect(response).to have_http_status(:forbidden)
    end
  end
end
