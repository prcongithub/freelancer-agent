# spec/requests/api/v1/client/projects_spec.rb
require "rails_helper"

RSpec.describe "Api::V1::Client::Projects", type: :request do
  let(:user) { FactoryBot.create(:user, :client, oauth_token: "tok") }
  let(:headers) { client_headers(user_id: user.id.to_s) }

  describe "GET /api/v1/client/projects" do
    it "returns the client's Freelancer projects" do
      allow_any_instance_of(ClientPortal::FreelancerClient)
        .to receive(:list_projects)
        .and_return([{ freelancer_id: "1", title: "My Project", bid_count: 5 }])

      get "/api/v1/client/projects", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["projects"].length).to eq(1)
      expect(json["projects"].first["title"]).to eq("My Project")
    end

    it "returns 403 for a freelancer user" do
      get "/api/v1/client/projects", headers: freelancer_headers
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 401 without auth" do
      get "/api/v1/client/projects"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/client/projects/:id/analyze_bids" do
    it "queues an AnalyzeBidsJob" do
      allow_any_instance_of(ClientPortal::FreelancerClient)
        .to receive(:list_projects)
        .and_return([{ freelancer_id: "42", title: "Project", bid_count: 3,
                       description: "desc", budget_range: {}, skills_required: [] }])

      expect {
        post "/api/v1/client/projects/42/analyze_bids", headers: headers
      }.to change(Sidekiq::Queues["default"], :size).by(1)

      expect(response).to have_http_status(:ok)
    end

    it "returns 404 when project not found in client's list" do
      allow_any_instance_of(ClientPortal::FreelancerClient)
        .to receive(:list_projects)
        .and_return([])

      post "/api/v1/client/projects/99/analyze_bids", headers: headers
      expect(response).to have_http_status(:not_found)
    end
  end
end
