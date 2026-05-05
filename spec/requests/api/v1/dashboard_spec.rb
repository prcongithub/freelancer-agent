require "rails_helper"

RSpec.describe "Api::V1::Dashboard", type: :request do
  describe "GET /api/v1/dashboard" do
    it "returns pipeline counts, stats, and recent projects" do
      Project.create!(freelancer_id: "1", title: "Project A", status: "discovered",
                      fit_score: { "total" => 80 }, category: "fullstack", discovered_at: Time.current)
      Project.create!(freelancer_id: "2", title: "Project B", status: "bid_sent",
                      fit_score: { "total" => 70 }, category: "aws_devops", discovered_at: Time.current)

      get "/api/v1/dashboard"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)

      expect(json).to have_key("pipeline")
      expect(json).to have_key("stats")
      expect(json).to have_key("recent_projects")

      expect(json["pipeline"]["discovered"]).to eq(1)
      expect(json["pipeline"]["bid_sent"]).to eq(1)
      expect(json["stats"]["total_discovered"]).to eq(2)
      expect(json["recent_projects"].length).to eq(2)
    end
  end
end
