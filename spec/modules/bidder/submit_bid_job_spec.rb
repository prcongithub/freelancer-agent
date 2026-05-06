require "rails_helper"

RSpec.describe Bidder::SubmitBidJob do
  let(:project) do
    Project.create!(
      freelancer_id: "fp123",
      title: "Build AWS Dashboard",
      description: "Need ECS and React setup",
      status: "discovered",
      category: "fullstack",
      budget_range: { "min" => 1000, "max" => 3000, "currency" => "USD" },
      skills_required: ["React", "AWS"],
      fit_score: { "total" => 80, "agent_buildable" => 30 }
    )
  end

  let(:pricing_engine) { instance_double(Bidder::PricingEngine) }
  let(:proposal_generator) { instance_double(Bidder::ProposalGenerator) }

  before do
    allow(Bidder::PricingEngine).to receive(:new).and_return(pricing_engine)
    allow(Bidder::ProposalGenerator).to receive(:new).and_return(proposal_generator)
    allow(pricing_engine).to receive(:calculate).and_return({
      amount: 1500,
      hourly_rate: 75,
      estimated_hours: 20,
      discount_applied: 0.0
    })
    allow(proposal_generator).to receive(:generate).and_return("I'd love to work on your project...")
    allow(Prototype).to receive_message_chain(:by_project, :approved, :first).and_return(nil)
  end

  describe "#perform" do
    it "creates a bid and updates project status on success" do
      stub_request(:post, /freelancer\.com\/api\/projects\/0\.1\/bids/)
        .to_return(
          status: 200,
          body: { result: { id: 99999 } }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      expect {
        described_class.new.perform(project.id.to_s)
      }.to change(Bid, :count).by(1)

      bid = Bid.find_by(project: project)
      expect(bid.amount).to eq(1500)
      expect(bid.status).to eq("submitted")
      expect(bid.freelancer_bid_id).to eq("99999")

      project.reload
      expect(project.status).to eq("bid_sent")
    end

    it "is idempotent — does not create a second bid on retry" do
      stub_request(:post, /freelancer\.com\/api\/projects\/0\.1\/bids/)
        .to_return(
          status: 200,
          body: { result: { id: 88888 } }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      described_class.new.perform(project.id.to_s)

      # Reset project status to simulate a retry where status update failed
      project.update!(status: "discovered")

      expect {
        described_class.new.perform(project.id.to_s)
      }.not_to change(Bid, :count)
    end

    it "raises when Freelancer API returns non-success" do
      stub_request(:post, /freelancer\.com\/api\/projects\/0\.1\/bids/)
        .to_return(status: 401, body: { message: "Unauthorized" }.to_json)

      expect {
        described_class.new.perform(project.id.to_s)
      }.to raise_error(RuntimeError, /Freelancer API submission failed/)
    end

    it "does not process a project that is not in discovered status" do
      project.update!(status: "bid_sent")

      expect {
        described_class.new.perform(project.id.to_s)
      }.not_to change(Bid, :count)
    end
  end
end
