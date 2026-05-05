module Bidder
  class SubmitBidJob
    include Sidekiq::Job
    sidekiq_options queue: :bidding, retry: 3

    def perform(project_id)
      project = Project.find(project_id)
      return unless project.status == "discovered"

      # Idempotency: don't create a second bid if one already exists for this project
      existing_bid = Bid.where(project_id: project.id).first
      if existing_bid
        # If bid exists but project wasn't updated, try to finish the job
        project.update!(status: "bid_sent", bid_at: Time.current) if project.status == "discovered"
        return
      end

      pricing_engine     = PricingEngine.new
      proposal_generator = ProposalGenerator.new

      project_data = {
        title:           project.title,
        description:     project.description,
        category:        project.category,
        budget_range:    project.budget_range&.transform_keys(&:to_sym) || {},
        skills_required: project.skills_required,
        fit_score:       project.fit_score&.transform_keys(&:to_sym) || {}
      }

      pricing  = pricing_engine.calculate(project_data)
      proposal = proposal_generator.generate(project_data)

      bid = Bid.create!(
        project:           project,
        amount:            pricing[:amount],
        currency:          "USD",
        proposal_text:     proposal,
        pricing_breakdown: pricing,
        status:            "submitted",
        submitted_at:      Time.current
      )

      submit_to_freelancer(project, bid)
      project.update!(status: "bid_sent", bid_at: Time.current)
    rescue Mongoid::Errors::DocumentNotFound
      Rails.logger.error("SubmitBidJob: Project #{project_id} not found")
    end

    private

    def submit_to_freelancer(project, bid)
      conn = Faraday.new(url: ENV.fetch("FREELANCER_API_BASE_URL", "https://www.freelancer.com/api")) do |f|
        f.request :json
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = ENV.fetch("FREELANCER_API_TOKEN", "")
      end

      response = conn.post("projects/0.1/bids/") do |req|
        req.body = {
          project_id:           project.freelancer_id.to_i,
          amount:               bid.amount,
          period:               7,
          milestone_percentage: 100,
          description:          bid.proposal_text
        }
      end

      unless response.success?
        Rails.logger.error("SubmitBidJob: Freelancer API error #{response.status}: #{response.body}")
        raise "Freelancer API submission failed with status #{response.status}"
      end

      bid_id = response.body.dig("result", "id")
      bid.update!(freelancer_bid_id: bid_id.to_s) if bid_id
    rescue Faraday::ConnectionFailed, Faraday::TimeoutError => e
      Rails.logger.error("SubmitBidJob#submit_to_freelancer network error: #{e.message}")
      raise  # re-raise so Sidekiq retries
    end
  end
end
