module ClientPortal
  class FreelancerClient
    BASE_URL = ENV.fetch("FREELANCER_API_BASE_URL", "https://www.freelancer.com/api")

    def initialize(oauth_token)
      @conn = Faraday.new(url: BASE_URL) do |f|
        f.request :json
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = oauth_token
      end
    end

    def list_projects
      response = @conn.get("projects/0.1/projects/active") do |req|
        req.params["owner_id"]         = "self"
        req.params["compact"]          = false
        req.params["bid_details"]      = true
        req.params["full_description"] = true
      end
      return [] unless response.success?
      (response.body.dig("result", "projects") || []).map { |p| normalize_project(p) }
    rescue Faraday::Error => e
      Rails.logger.error("ClientPortal::FreelancerClient#list_projects: #{e.message}")
      []
    end

    def list_bids(project_id)
      response = @conn.get("projects/0.1/bids") do |req|
        req.params["project_ids[]"]  = project_id
        req.params["bidder_details"] = true
        req.params["limit"]          = 100
      end
      return [] unless response.success?
      (response.body.dig("result", "bids") || []).map { |b| normalize_bid(b) }
    rescue Faraday::Error => e
      Rails.logger.error("ClientPortal::FreelancerClient#list_bids: #{e.message}")
      []
    end

    private

    def normalize_project(p)
      {
        freelancer_id:   p["id"].to_s,
        title:           p["title"],
        description:     p["description"] || p["preview_description"],
        budget_range:    {
          min:      p.dig("budget", "minimum"),
          max:      p.dig("budget", "maximum"),
          currency: p.dig("currency", "code") || "USD"
        },
        skills_required: (p["jobs"] || []).map { |j| j["name"] },
        bid_count:       p.dig("bid_stats", "bid_count") || 0,
        bid_avg:         p.dig("bid_stats", "bid_avg")&.round(2)
      }
    end

    def normalize_bid(b)
      bidder  = b["bidder_details"] || {}
      history = bidder.dig("reputation", "entire_history") || {}
      {
        bid_id:           b["id"].to_s,
        bidder_id:        b["bidder_id"].to_s,
        bidder_name:      bidder["username"],
        amount:           b["amount"],
        delivery_days:    b["period"],
        proposal_text:    b["description"],
        bidder_rating:    history["overall"]&.to_f,
        bidder_reviews:   history["reviews"]&.to_i || 0,
        payment_verified: bidder.dig("status", "payment_verified") || false
      }
    end
  end
end
