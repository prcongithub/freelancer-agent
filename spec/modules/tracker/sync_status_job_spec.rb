require "rails_helper"

RSpec.describe Tracker::SyncStatusJob do
  describe "#perform" do
    let(:project) do
      Project.create!(freelancer_id: "fp123", title: "Test Project", status: "bid_sent",
                      fit_score: { "total" => 80 })
    end
    let!(:bid) do
      Bid.create!(project: project, amount: 1000, status: "submitted",
                  submitted_at: Time.current, freelancer_bid_id: "456")
    end

    it "updates bid and project status to shortlisted" do
      stub_request(:get, /freelancer\.com\/api\/projects\/0\.1\/bids/)
        .to_return(
          status: 200,
          body: {
            result: { bids: [{ id: 456, award_status: "shortlisted" }] }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      described_class.new.perform

      bid.reload
      expect(bid.status).to eq("shortlisted")
      project.reload
      expect(project.status).to eq("shortlisted")
    end

    it "updates bid and project status to won" do
      stub_request(:get, /freelancer\.com\/api\/projects\/0\.1\/bids/)
        .to_return(
          status: 200,
          body: {
            result: { bids: [{ id: 456, award_status: "awarded" }] }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      described_class.new.perform

      bid.reload
      expect(bid.status).to eq("won")
      project.reload
      expect(project.status).to eq("won")
    end

    it "handles empty bid list gracefully" do
      # Create project with no bids
      Bid.delete_all
      described_class.new.perform
      # No errors, no state changes
    end

    it "handles Freelancer API network error gracefully" do
      stub_request(:get, /freelancer\.com\/api\/projects\/0\.1\/bids/)
        .to_raise(Faraday::ConnectionFailed.new("connection refused"))

      expect { described_class.new.perform }.not_to raise_error
    end
  end
end
