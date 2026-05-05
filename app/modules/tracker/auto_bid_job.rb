module Tracker
  class AutoBidJob
    include Sidekiq::Job
    sidekiq_options queue: :bidding

    def perform
      threshold = Setting.instance.auto_bid_threshold

      Project.where(status: "discovered")
             .above_threshold(threshold)
             .each do |project|
        Bidder::SubmitBidJob.perform_async(project.id.to_s)
      end
    end
  end
end
