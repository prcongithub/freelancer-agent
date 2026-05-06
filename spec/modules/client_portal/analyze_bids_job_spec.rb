# spec/modules/client_portal/analyze_bids_job_spec.rb
require "rails_helper"

RSpec.describe ClientPortal::AnalyzeBidsJob do
  let(:user) { FactoryBot.create(:user, :client, oauth_token: "tok") }
  let(:project_info) do
    { "freelancer_id" => "p42", "title" => "API project",
      "description" => "desc", "budget_range" => {}, "skills_required" => [] }
  end

  it "creates a ClientAnalysis record on success" do
    bids = [{ bidder_name: "Alice", amount: 400, delivery_days: 7,
              proposal_text: "Good", bidder_rating: 4.5, bidder_reviews: 10,
              payment_verified: true }]

    allow_any_instance_of(ClientPortal::FreelancerClient).to receive(:list_bids).and_return(bids)
    allow_any_instance_of(ClientPortal::BidAnalyzer).to receive(:analyze).and_return(
      { "shortlist" => [{ "rank" => 1, "bidder_name" => "Alice", "score" => 80 }] }
    )

    expect {
      described_class.new.perform(user.id.to_s, project_info)
    }.to change(ClientAnalysis, :count).by(1)

    ca = ClientAnalysis.find_by(project_freelancer_id: "p42")
    expect(ca.shortlist.length).to eq(1)
    expect(ca.client_user_id).to eq(user.id.to_s)
  end

  it "skips if no bids available" do
    allow_any_instance_of(ClientPortal::FreelancerClient).to receive(:list_bids).and_return([])

    expect {
      described_class.new.perform(user.id.to_s, project_info)
    }.not_to change(ClientAnalysis, :count)
  end

  it "skips if analyzer returns nil" do
    bids = [{ bidder_name: "Alice", amount: 400 }]
    allow_any_instance_of(ClientPortal::FreelancerClient).to receive(:list_bids).and_return(bids)
    allow_any_instance_of(ClientPortal::BidAnalyzer).to receive(:analyze).and_return(nil)

    expect {
      described_class.new.perform(user.id.to_s, project_info)
    }.not_to change(ClientAnalysis, :count)
  end

  it "logs and skips on unknown user" do
    expect(Rails.logger).to receive(:warn).with(/nonexistent_id/)
    expect {
      described_class.new.perform("nonexistent_id", project_info)
    }.not_to raise_error
  end
end
