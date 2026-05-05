require "rails_helper"

RSpec.describe "Api::V1::Projects", type: :request do
  describe "GET /api/v1/projects" do
    it "returns all projects as JSON" do
      Project.create!(freelancer_id: "1", title: "Project A", status: "discovered", fit_score: { "total" => 80 })
      Project.create!(freelancer_id: "2", title: "Project B", status: "bid_sent", fit_score: { "total" => 70 })

      get "/api/v1/projects"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["projects"].length).to eq(2)
    end

    it "filters by status" do
      Project.create!(freelancer_id: "1", title: "A", status: "discovered", fit_score: { "total" => 80 })
      Project.create!(freelancer_id: "2", title: "B", status: "bid_sent", fit_score: { "total" => 70 })

      get "/api/v1/projects", params: { status: "discovered" }

      json = JSON.parse(response.body)
      expect(json["projects"].length).to eq(1)
      expect(json["projects"][0]["title"]).to eq("A")
    end
  end

  describe "POST /api/v1/projects/:id/approve_bid" do
    it "queues a bid job for a discovered project" do
      project = Project.create!(freelancer_id: "1", title: "A", status: "discovered",
                                fit_score: { "total" => 70 }, category: "fullstack")

      expect {
        post "/api/v1/projects/#{project.id}/approve_bid"
      }.to change(Sidekiq::Queues["bidding"], :size).by(1)

      expect(response).to have_http_status(:ok)
    end

    it "returns error for non-discovered project" do
      project = Project.create!(freelancer_id: "1", title: "A", status: "bid_sent",
                                fit_score: { "total" => 70 })

      post "/api/v1/projects/#{project.id}/approve_bid"

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "POST /api/v1/projects/:id/reject" do
    it "marks project as lost" do
      project = Project.create!(freelancer_id: "1", title: "A", status: "discovered",
                                fit_score: { "total" => 70 })

      post "/api/v1/projects/#{project.id}/reject"

      expect(response).to have_http_status(:ok)
      project.reload
      expect(project.status).to eq("lost")
    end
  end
end
