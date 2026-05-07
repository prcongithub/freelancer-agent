module Scanner
  class ScanJob
    include Sidekiq::Job
    sidekiq_options queue: :scanning

    KEYWORD_GROUPS = {
      aws_devops: %w[aws docker kubernetes terraform devops],
      backend: ["ruby on rails", "node.js", "express", "python api"],
      frontend: %w[react angular typescript dashboard],
      ai_automation: ["ai agent", "chatbot", "openai", "claude", "rag"],
      fullstack: ["full stack", "web application", "saas"]
    }.freeze

    def perform(user_id = nil)
      cfg    = AgentConfig.for("scanner").config
      groups = (cfg["keyword_groups"] || {}).presence&.transform_keys(&:to_sym) || KEYWORD_GROUPS
      threshold = cfg.fetch("threshold", 65).to_i
      skill_min = cfg.fetch("skill_match_minimum", 25).to_i

      client = FreelancerClient.new
      scorer = ProjectScorer.new

      groups.each do |_category, keywords|
        projects = client.search_projects(keywords: Array(keywords))
        projects.each do |project_data|
          score    = scorer.score(project_data)
          category = scorer.categorize(project_data)

          next if score[:total] < threshold
          next if category.nil?
          next if score[:skill_match] < skill_min
          next if (project_data.dig(:budget_range, :currency) || "USD") != "USD"

          begin
            project = Project.create!(
              user_id:         user_id,
              freelancer_id:   project_data[:freelancer_id],
              title:           project_data[:title],
              description:     project_data[:description],
              budget_range:    project_data[:budget_range],
              skills_required: project_data[:skills_required],
              client:          project_data[:client],
              freelancer_url:  project_data[:freelancer_url],
              bid_stats:       project_data[:bid_stats] || {},
              upgrades:        project_data[:upgrades] || {},
              fit_score:       score,
              category:        category,
              status:          "discovered",
              discovered_at:   Time.current
            )
            Analyzer::AnalyzeJob.perform_async(project.id.to_s)
          rescue Mongoid::Errors::Validations => e
            next if e.document.errors[:freelancer_id].any?
            raise
          rescue Mongo::Error::OperationFailure => e
            next if e.message.include?("11000")
            raise
          end
        end
      end
    end
  end
end
