require "rails_helper"

RSpec.describe ClientPortal::BidAnalyzer do
  subject { described_class.new }

  let(:project) do
    {
      title: "Build a REST API",
      description: "Need a Rails API with authentication",
      budget_range: { min: 200, max: 800, currency: "USD" },
      skills_required: ["Ruby on Rails", "PostgreSQL"]
    }
  end

  let(:bids) do
    [
      { bidder_name: "alice_dev", amount: 500, delivery_days: 7,
        proposal_text: "I have built many Rails APIs.", bidder_rating: 4.9,
        bidder_reviews: 45, payment_verified: true },
      { bidder_name: "bob_coder", amount: 300, delivery_days: 14,
        proposal_text: "I can help.", bidder_rating: 3.2,
        bidder_reviews: 5, payment_verified: false }
    ]
  end

  let(:bedrock_response) do
    {
      shortlist: [
        { rank: 1, bidder_name: "alice_dev", bid_amount: 500, score: 88,
          strengths: ["strong portfolio"], concerns: ["above budget midpoint"],
          summary: "Best fit overall." },
        { rank: 2, bidder_name: "bob_coder", bid_amount: 300, score: 55,
          strengths: ["lowest price"], concerns: ["few reviews", "vague proposal"],
          summary: "Budget option, higher risk." }
      ]
    }.to_json
  end

  it "returns a shortlist from Bedrock" do
    allow_any_instance_of(Aws::BedrockRuntime::Client).to receive(:converse)
      .and_return(
        double(output: double(message: double(content: [double(text: bedrock_response)])))
      )

    result = subject.analyze(project: project, bids: bids)
    expect(result["shortlist"].length).to eq(2)
    expect(result["shortlist"].first["rank"]).to eq(1)
    expect(result["shortlist"].first["bidder_name"]).to eq("alice_dev")
  end

  it "returns nil on Bedrock error" do
    allow_any_instance_of(Aws::BedrockRuntime::Client).to receive(:converse)
      .and_raise(Aws::BedrockRuntime::Errors::ServiceError.new(nil, "error"))

    result = subject.analyze(project: project, bids: bids)
    expect(result).to be_nil
  end

  it "returns nil when bids array is empty" do
    result = subject.analyze(project: project, bids: [])
    expect(result).to be_nil
  end
end
