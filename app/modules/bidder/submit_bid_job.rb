module Bidder
  class SubmitBidJob
    include Sidekiq::Job
    sidekiq_options queue: :bidding, retry: 3

    def perform(project_id, user_id = nil)
      project = Project.find(project_id)
      return unless project.status == "discovered"

      @bid_user = resolve_user(user_id)

      # Idempotency: if already submitted to Freelancer, nothing to do
      existing_bid = Bid.where(project_id: project.id).first
      if existing_bid
        if existing_bid.freelancer_bid_id.present?
          project.set(status: "bid_sent", bid_at: Time.current)
          return
        end
        # Bid record exists but Freelancer submission failed — retry submission only
        submit_to_freelancer(project, existing_bid)
        project.set(status: "bid_sent", bid_at: Time.current)
        return
      end

      pricing_engine     = PricingEngine.new
      proposal_generator = ProposalGenerator.new

      # Find approved prototype for this project
      approved_proto = Prototype.by_project(project.id).approved.first

      project_data = {
        title:           project.title,
        description:     project.description,
        category:        project.category,
        budget_range:    project.budget_range&.transform_keys(&:to_sym) || {},
        skills_required: project.skills_required,
        fit_score:       project.fit_score&.transform_keys(&:to_sym) || {},
        analysis:        project.analysis,
        prototype_url:   approved_proto&.public_url
      }

      pricing  = pricing_engine.calculate(project_data)
      proposal = proposal_generator.generate(project_data)

      bid = Bid.create!(
        project:           project,
        amount:            pricing[:amount],        # in project currency
        currency:          pricing[:currency] || "USD",
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

    def resolve_user(user_id)
      return nil unless user_id
      User.find(user_id)
    rescue Mongoid::Errors::DocumentNotFound
      nil
    end

    def api_token
      @bid_user&.oauth_token.presence || ENV.fetch("FREELANCER_API_TOKEN", "")
    end

    def freelancer_user_id
      @bid_user&.freelancer_user_id.presence || ENV.fetch("FREELANCER_USER_ID", "")
    end

    def submit_to_freelancer(project, bid)
      conn = Faraday.new(url: ENV.fetch("FREELANCER_API_BASE_URL", "https://www.freelancer.com/api")) do |f|
        f.request :json
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = api_token
      end

      response = conn.post("projects/0.1/bids/") do |req|
        req.body = {
          project_id:           project.freelancer_id.to_i,
          bidder_id:            freelancer_user_id.to_i,
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
