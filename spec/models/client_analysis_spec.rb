require "rails_helper"

RSpec.describe ClientAnalysis, type: :model do
  let(:user) { FactoryBot.create(:user, :client) }

  it "has a valid factory" do
    expect(FactoryBot.build(:client_analysis, client_user_id: user.id.to_s)).to be_valid
  end

  it "is valid with required fields" do
    ca = ClientAnalysis.new(
      project_freelancer_id: "p123",
      client_user_id: user.id.to_s,
      shortlist: [{ rank: 1, bidder_name: "Alice", score: 85 }]
    )
    expect(ca).to be_valid
  end

  it "requires project_freelancer_id" do
    ca = ClientAnalysis.new(client_user_id: user.id.to_s, shortlist: [])
    expect(ca).not_to be_valid
  end

  it "requires client_user_id" do
    ca = ClientAnalysis.new(project_freelancer_id: "p123", shortlist: [])
    expect(ca).not_to be_valid
  end
end
