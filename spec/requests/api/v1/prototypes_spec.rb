require 'rails_helper'

RSpec.describe "Api::V1::Prototypes", type: :request do
  let!(:project) do
    Project.create!(
      freelancer_id: "proto_test_#{SecureRandom.hex(4)}",
      title: "Test Project",
      status: "discovered"
    )
  end

  describe "POST /api/v1/projects/:id/prototype" do
    it "creates a Prototype and returns 202" do
      allow(Prototyper::PrototypeGeneratorJob).to receive(:perform_async)
      post "/api/v1/projects/#{project.id}/prototype"
      expect(response).to have_http_status(:accepted)
      body = JSON.parse(response.body)
      expect(body["prototype"]["status"]).to eq("generating")
      expect(body["prototype"]["proto_id"]).to match(/\A[a-z0-9]{6}\z/)
    end

    it "returns existing prototype if already generating" do
      proto = Prototype.create!(project_id: project.id.to_s, status: "generating")
      allow(Prototyper::PrototypeGeneratorJob).to receive(:perform_async)
      post "/api/v1/projects/#{project.id}/prototype"
      expect(response).to have_http_status(:accepted)
      expect(JSON.parse(response.body)["prototype"]["id"]).to eq(proto.id.to_s)
    end
  end

  describe "GET /api/v1/projects/:id/prototype" do
    it "returns 404 when no prototype exists" do
      get "/api/v1/projects/#{project.id}/prototype"
      expect(response).to have_http_status(:not_found)
    end

    it "returns the prototype when it exists" do
      Prototype.create!(project_id: project.id.to_s, status: "ready", public_url: "https://example.com")
      get "/api/v1/projects/#{project.id}/prototype"
      expect(response).to have_http_status(:ok)
      expect(JSON.parse(response.body)["prototype"]["status"]).to eq("ready")
    end
  end

  describe "POST /api/v1/prototypes/:id/approve" do
    it "sets status=approved and approved_at" do
      proto = Prototype.create!(project_id: project.id.to_s, status: "ready")
      post "/api/v1/prototypes/#{proto.id}/approve"
      expect(response).to have_http_status(:ok)
      proto.reload
      expect(proto.status).to eq("approved")
      expect(proto.approved_at).not_to be_nil
    end
  end

  describe "POST /api/v1/prototypes/:id/reject" do
    it "sets status=rejected" do
      proto = Prototype.create!(project_id: project.id.to_s, status: "ready")
      post "/api/v1/prototypes/#{proto.id}/reject"
      expect(response).to have_http_status(:ok)
      expect(proto.reload.status).to eq("rejected")
    end
  end
end
