module Tracker
  class SyncStatusJob
    include Sidekiq::Job
    sidekiq_options queue: :default

    BID_AWARD_STATUS_MAP = {
      "shortlisted" => "shortlisted",
      "awarded"     => "won",
      "accepted"    => "won",
      "rejected"    => "lost",
      "revoked"     => "lost"
    }.freeze

    def perform
      active_bids = Bid.where(:status.in => %w[submitted viewed shortlisted],
                               :freelancer_bid_id.exists => true,
                               :freelancer_bid_id.ne => "")

      return if active_bids.empty?

      conn = build_connection

      active_bids.each do |bid|
        sync_bid(conn, bid)
      rescue Faraday::Error => e
        Rails.logger.error("Tracker::SyncStatusJob: network error for bid #{bid.id}: #{e.message}")
      rescue => e
        Rails.logger.error("Tracker::SyncStatusJob: error for bid #{bid.id}: #{e.class}: #{e.message}")
      end
    end

    private

    def build_connection
      Faraday.new(url: ENV.fetch("FREELANCER_API_BASE_URL", "https://www.freelancer.com/api")) do |f|
        f.request :json
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = ENV.fetch("FREELANCER_API_TOKEN", "")
      end
    end

    def sync_bid(conn, bid)
      response = conn.get("projects/0.1/bids") do |req|
        req.params["bids[]"]         = bid.freelancer_bid_id
        req.params["bid_statuses[]"] = "active"
      end

      return unless response.success?

      remote_bids = response.body.dig("result", "bids") || []
      remote_bid  = remote_bids.find { |b| b["id"].to_s == bid.freelancer_bid_id }
      return unless remote_bid

      new_status = BID_AWARD_STATUS_MAP[remote_bid["award_status"]]
      return unless new_status && new_status != bid.status

      bid.update!(status: new_status)
      sync_project_status(bid.project, new_status)
    end

    def sync_project_status(project, bid_status)
      case bid_status
      when "shortlisted"
        project.update!(status: "shortlisted")
      when "won"
        project.update!(status: "won", won_at: Time.current)
      when "lost"
        project.update!(status: "lost")
      end
    end
  end
end
