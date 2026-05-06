require "rails_helper"

RSpec.describe ClientPortal::FreelancerClient do
  let(:token) { "client_oauth_token" }
  subject { described_class.new(token) }

  describe "#list_projects" do
    it "returns client's active projects" do
      stub_request(:get, /freelancer\.com\/api\/projects.*active/)
        .to_return(
          status: 200,
          body: {
            result: {
              projects: [
                { id: 1, title: "Build a website", bid_stats: { bid_count: 10, bid_avg: 350.5 },
                  budget: { minimum: 100, maximum: 500 }, currency: { code: "USD" },
                  jobs: [{ name: "React" }], description: "Need a site" }
              ]
            }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      projects = subject.list_projects
      expect(projects.length).to eq(1)
      expect(projects.first[:title]).to eq("Build a website")
      expect(projects.first[:bid_count]).to eq(10)
      expect(projects.first[:skills_required]).to eq(["React"])
    end

    it "returns empty array on API failure" do
      stub_request(:get, /freelancer\.com\/api\/projects/).to_return(status: 500)
      expect(subject.list_projects).to eq([])
    end

    it "raises ApiError on network failure" do
      stub_request(:get, /freelancer\.com\/api\/projects/).to_raise(Faraday::ConnectionFailed.new("connection refused"))
      expect { subject.list_projects }.to raise_error(ClientPortal::FreelancerClient::ApiError)
    end
  end

  describe "#list_bids" do
    it "returns bids for a project" do
      stub_request(:get, /freelancer\.com\/api\/projects.*bids/)
        .to_return(
          status: 200,
          body: {
            result: {
              bids: [
                { id: 10, bidder_id: 5, amount: 300, period: 7,
                  description: "I can do this",
                  bidder_details: {
                    username: "alice_dev",
                    reputation: { entire_history: { overall: 4.8, reviews: 25 } },
                    status: { payment_verified: true }
                  }
                }
              ]
            }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      bids = subject.list_bids("42")
      expect(bids.length).to eq(1)
      expect(bids.first[:bidder_name]).to eq("alice_dev")
      expect(bids.first[:amount]).to eq(300)
      expect(bids.first[:bidder_rating]).to eq(4.8)
    end

    it "returns empty array on API failure" do
      stub_request(:get, /freelancer\.com\/api\/projects.*bids/).to_return(status: 500)
      expect(subject.list_bids("1")).to eq([])
    end
  end
end
