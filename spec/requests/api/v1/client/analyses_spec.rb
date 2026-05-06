# spec/requests/api/v1/client/analyses_spec.rb
require "rails_helper"

RSpec.describe "Api::V1::Client::Analyses", type: :request do
  let(:user) { FactoryBot.create(:user, :client) }
  let(:headers) { client_headers(user_id: user.id.to_s) }

  describe "GET /api/v1/client/analyses/:id" do
    it "returns an analysis for the current user" do
      ca = ClientAnalysis.create!(
        project_freelancer_id: "p1",
        client_user_id: user.id.to_s,
        shortlist: [{ "rank" => 1, "bidder_name" => "Alice", "score" => 90 }],
        analyzed_at: Time.current
      )

      get "/api/v1/client/analyses/#{ca.id}", headers: headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["analysis"]["shortlist"].length).to eq(1)
      expect(json["analysis"]["project_freelancer_id"]).to eq("p1")
    end

    it "returns 404 for another user's analysis" do
      other = FactoryBot.create(:user, :client)
      ca = ClientAnalysis.create!(
        project_freelancer_id: "p2",
        client_user_id: other.id.to_s,
        shortlist: []
      )

      get "/api/v1/client/analyses/#{ca.id}", headers: headers
      expect(response).to have_http_status(:not_found)
    end

    it "returns 403 for freelancer users" do
      ca = ClientAnalysis.create!(
        project_freelancer_id: "p3",
        client_user_id: user.id.to_s,
        shortlist: []
      )
      get "/api/v1/client/analyses/#{ca.id}", headers: freelancer_headers
      expect(response).to have_http_status(:forbidden)
    end

    it "returns 401 without auth" do
      get "/api/v1/client/analyses/some_id"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
