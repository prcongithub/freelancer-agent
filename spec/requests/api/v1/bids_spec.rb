require "rails_helper"

RSpec.describe "Api::V1::Bids", type: :request do
  let(:project) { Project.create!(freelancer_id: "p1", title: "Test Project") }

  describe "GET /api/v1/bids" do
    it "returns all bids as JSON" do
      Bid.create!(project: project, amount: 1500, status: "submitted",
                  submitted_at: Time.current,
                  pricing_breakdown: { "hourly_rate" => 75, "estimated_hours" => 20 })

      get "/api/v1/bids"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["bids"].length).to eq(1)
      expect(json["bids"][0]["amount"]).to eq(1500)
      expect(json["bids"][0]["project_title"]).to eq("Test Project")
    end

    it "filters by status" do
      Bid.create!(project: project, amount: 1500, status: "submitted", submitted_at: Time.current)
      Bid.create!(project: project, amount: 2000, status: "won", submitted_at: Time.current)

      get "/api/v1/bids", params: { status: "won" }

      json = JSON.parse(response.body)
      expect(json["bids"].length).to eq(1)
      expect(json["bids"][0]["status"]).to eq("won")
    end
  end
end
