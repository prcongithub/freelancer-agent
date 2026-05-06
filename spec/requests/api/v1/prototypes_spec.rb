require "rails_helper"

RSpec.describe "Api::V1::Prototypes", type: :request do
  let(:project) { Project.create!(freelancer_id: "1", title: "Test Project", status: "discovered", fit_score: { "total" => 80 }) }

  describe "POST /api/v1/projects/:id/prototype" do
    it "creates a prototype and enqueues the generator job" do
      expect {
        post "/api/v1/projects/#{project.id}/prototype"
      }.to change(Sidekiq::Queues["default"], :size).by(1)

      expect(response).to have_http_status(:accepted)
      json = JSON.parse(response.body)
      expect(json["prototype"]["status"]).to eq("generating")
      expect(json["prototype"]["project_id"]).to eq(project.id.to_s)
    end

    it "returns existing prototype if one is already active" do
      existing = Prototype.create!(project_id: project.id.to_s, status: "ready")

      post "/api/v1/projects/#{project.id}/prototype"

      expect(response).to have_http_status(:accepted)
      json = JSON.parse(response.body)
      expect(json["prototype"]["id"]).to eq(existing.id.to_s)
    end

    it "returns 404 for unknown project" do
      post "/api/v1/projects/000000000000000000000000/prototype"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/projects/:id/prototype" do
    it "returns the latest prototype for a project" do
      Prototype.create!(project_id: project.id.to_s, status: "ready")

      get "/api/v1/projects/#{project.id}/prototype"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["prototype"]["project_id"]).to eq(project.id.to_s)
    end

    it "returns 404 when no prototype exists" do
      get "/api/v1/projects/#{project.id}/prototype"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST /api/v1/prototypes/:id/approve" do
    it "sets status to approved" do
      prototype = Prototype.create!(project_id: project.id.to_s, status: "ready")

      post "/api/v1/prototypes/#{prototype.id}/approve"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["prototype"]["status"]).to eq("approved")
      expect(json["prototype"]["approved"]).to be true
    end
  end

  describe "POST /api/v1/prototypes/:id/reject" do
    it "sets status to rejected" do
      prototype = Prototype.create!(project_id: project.id.to_s, status: "ready")

      post "/api/v1/prototypes/#{prototype.id}/reject"

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["prototype"]["status"]).to eq("rejected")
    end
  end
end
