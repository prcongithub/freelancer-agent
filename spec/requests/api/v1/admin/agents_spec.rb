require 'rails_helper'

RSpec.describe "Api::V1::Admin::Agents", type: :request do
  before { AgentConfig.seed_defaults! }

  describe "GET /api/v1/admin/agents" do
    it "returns all 6 agents" do
      get "/api/v1/admin/agents", headers: admin_headers
      expect(response).to have_http_status(:ok)
      expect(json["agents"].length).to eq(6)
    end

    it "returns 403 for non-admin" do
      get "/api/v1/admin/agents", headers: freelancer_headers
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/admin/agents/:agent" do
    it "returns the agent config" do
      get "/api/v1/admin/agents/scanner", headers: admin_headers
      expect(response).to have_http_status(:ok)
      expect(json["agent"]["agent"]).to eq("scanner")
      expect(json["agent"]["config"]["threshold"]).to eq(65)
    end

    it "returns 404 for unknown agent" do
      get "/api/v1/admin/agents/unknown", headers: admin_headers
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/admin/agents/:agent" do
    it "updates the agent config" do
      patch "/api/v1/admin/agents/scanner",
            params: { config: { threshold: 75, skill_match_minimum: 30, keyword_groups: {} } }.to_json,
            headers: admin_headers.merge("Content-Type" => "application/json")
      expect(response).to have_http_status(:ok)
      expect(json["agent"]["config"]["threshold"]).to eq(75)
      expect(AgentConfig.for("scanner").config["threshold"]).to eq(75)
    end

    it "returns 404 for unknown agent" do
      patch "/api/v1/admin/agents/unknown",
            params: { config: {} }.to_json,
            headers: admin_headers.merge("Content-Type" => "application/json")
      expect(response).to have_http_status(:not_found)
    end
  end

  def json
    JSON.parse(response.body)
  end
end
