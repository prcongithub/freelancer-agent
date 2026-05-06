module ClientPortal
  class AnalyzeBidsJob
    include Sidekiq::Job
    sidekiq_options queue: :default, retry: 2

    def perform(user_id, project_info)
      user = User.find(user_id)
      fl_client = ClientPortal::FreelancerClient.new(user.oauth_token)

      bids = fl_client.list_bids(project_info["freelancer_id"])
      return if bids.empty?

      project = project_info.transform_keys(&:to_sym)
      result  = ClientPortal::BidAnalyzer.new.analyze(project: project, bids: bids)
      return unless result

      ClientAnalysis.find_or_initialize_by(
        project_freelancer_id: project_info["freelancer_id"],
        client_user_id:        user_id
      ).tap do |ca|
        ca.shortlist   = result["shortlist"] || []
        ca.analyzed_at = Time.current
        ca.save!
      end
    rescue Mongoid::Errors::DocumentNotFound
      Rails.logger.warn("ClientPortal::AnalyzeBidsJob: user #{user_id} not found")
    end
  end
end
