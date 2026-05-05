require "rails_helper"

RSpec.describe Tracker::AutoBidJob do
  describe "#perform" do
    before { Sidekiq::Testing.fake! }
    after  { Sidekiq::Worker.clear_all }

    it "queues SubmitBidJob for discovered projects above auto_bid_threshold" do
      Setting.instance.update!(auto_bid_threshold: 80)
      Project.create!(freelancer_id: "1", title: "High Score", status: "discovered",
                      fit_score: { "total" => 85 }, category: "fullstack")
      Project.create!(freelancer_id: "2", title: "Low Score", status: "discovered",
                      fit_score: { "total" => 70 }, category: "fullstack")

      described_class.new.perform

      expect(Bidder::SubmitBidJob.jobs.size).to eq(1)
    end

    it "does not queue jobs for non-discovered projects" do
      Setting.instance.update!(auto_bid_threshold: 80)
      Project.create!(freelancer_id: "3", title: "Already Bid", status: "bid_sent",
                      fit_score: { "total" => 90 }, category: "fullstack")

      described_class.new.perform

      expect(Bidder::SubmitBidJob.jobs.size).to eq(0)
    end
  end
end
