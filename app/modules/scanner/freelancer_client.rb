module Scanner
  class FreelancerClient
    BASE_URL = ENV.fetch("FREELANCER_API_BASE_URL", "https://www.freelancer.com/api")

    def initialize
      @conn = Faraday.new(url: BASE_URL) do |f|
        f.request :json
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = ENV.fetch("FREELANCER_API_TOKEN", "")
      end
    end

    def search_projects(keywords:, limit: 50)
      response = @conn.get("projects/0.1/projects/active") do |req|
        req.params["query"] = keywords.join(" ")
        req.params["limit"] = limit
        req.params["compact"] = true
        req.params["job_details"] = true
        req.params["full_description"] = true
      end

      return [] unless response.success?

      projects = response.body.dig("result", "projects") || []
      projects.map { |p| normalize_project(p) }
    end

    def get_project_details(project_id)
      response = @conn.get("projects/0.1/projects/#{project_id}") do |req|
        req.params["full_description"] = true
        req.params["job_details"] = true
        req.params["user_details"] = true
      end

      return nil unless response.success?

      normalize_project(response.body.dig("result"))
    end

    private

    def normalize_project(p)
      {
        freelancer_id: p["id"].to_s,
        title: p["title"],
        description: p["preview_description"] || p["description"],
        budget_range: {
          min: p.dig("budget", "minimum"),
          max: p.dig("budget", "maximum"),
          currency: p.dig("currency", "code") || "USD"
        },
        skills_required: (p["jobs"] || []).map { |j| j["name"] },
        client: { id: p["owner_id"].to_s },
        time_submitted: p["time_submitted"]
      }
    end
  end
end
