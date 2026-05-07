module Tracker
  class AutoBidJob
    include Sidekiq::Job
    sidekiq_options queue: :bidding

    def perform
      cfg       = AgentConfig.for("tracker").config
      threshold = cfg.fetch("auto_bid_threshold", 80).to_i

      Project.where(status: "discovered")
             .above_threshold(threshold)
             .each do |project|
        Bidder::SubmitBidJob.perform_async(project.id.to_s)
      end
    end
  end
end
