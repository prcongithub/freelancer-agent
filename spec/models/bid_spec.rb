require "rails_helper"

RSpec.describe Bid, type: :model do
  let(:project) { Project.create!(freelancer_id: "p1", title: "Test Project") }

  describe "validations" do
    it "requires amount" do
      bid = Bid.new(project: project)
      expect(bid).not_to be_valid
      expect(bid.errors[:amount]).to be_present
    end

    it "requires project" do
      bid = Bid.new(amount: 500)
      expect(bid).not_to be_valid
      expect(bid.errors[:project]).to be_present
    end

    it "requires amount to be positive" do
      bid = Bid.new(project: project, amount: -100)
      expect(bid).not_to be_valid
    end
  end

  describe "defaults" do
    it "defaults status to draft" do
      bid = Bid.create!(project: project, amount: 500)
      expect(bid.status).to eq("draft")
    end

    it "defaults currency to USD" do
      bid = Bid.create!(project: project, amount: 500)
      expect(bid.currency).to eq("USD")
    end
  end
end
