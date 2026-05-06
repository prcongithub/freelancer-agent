require "rails_helper"

RSpec.describe "Api::V1::Settings", type: :request do
  describe "GET /api/v1/settings" do
    it "returns current settings" do
      get "/api/v1/settings", headers: freelancer_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["settings"]).to have_key("auto_bid_threshold")
      expect(json["settings"]).to have_key("approval_threshold")
      expect(json["settings"]).to have_key("skill_keywords")
      expect(json["settings"]).to have_key("pricing_floors")
      expect(json["settings"]["auto_bid_threshold"]).to eq(80)
      expect(json["settings"]["approval_threshold"]).to eq(60)
    end
  end

  describe "PATCH /api/v1/settings" do
    it "updates the thresholds" do
      patch "/api/v1/settings", params: { auto_bid_threshold: 85, approval_threshold: 65 },
                                headers: freelancer_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["settings"]["auto_bid_threshold"]).to eq(85)
      expect(json["settings"]["approval_threshold"]).to eq(65)
    end

    it "returns error for invalid threshold values" do
      patch "/api/v1/settings", params: { auto_bid_threshold: 150 },
                                headers: freelancer_headers

      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end
