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
      client = FreelancerClient.new
      scorer = ProjectScorer.new

      KEYWORD_GROUPS.each do |_category, keywords|
        projects = client.search_projects(keywords: keywords)

        projects.each do |project_data|
          score = scorer.score(project_data)
          category = scorer.categorize(project_data)

          threshold = 65
          threshold = Setting.threshold if defined?(Setting) && Setting.respond_to?(:threshold)
          next if score[:total] < threshold
          next if category.nil?           # no tech category = not relevant
          next if score[:skill_match] < 25 # must have real skill overlap
          next if (project_data.dig(:budget_range, :currency) || "USD") != "USD" # US projects only

          begin
            project = Project.create!(
              user_id:       user_id,
              freelancer_id: project_data[:freelancer_id],
              title: project_data[:title],
              description: project_data[:description],
              budget_range: project_data[:budget_range],
              skills_required: project_data[:skills_required],
              client: project_data[:client],
              freelancer_url: project_data[:freelancer_url],
              bid_stats: project_data[:bid_stats] || {},
              upgrades:  project_data[:upgrades] || {},
              fit_score: score,
              category: category,
              status: "discovered",
              discovered_at: Time.current
            )
            Analyzer::AnalyzeJob.perform_async(project.id.to_s)
          rescue Mongoid::Errors::Validations => e
            # Skip duplicates (uniqueness validation catches them)
            next if e.document.errors[:freelancer_id].any?
            raise
          rescue Mongo::Error::OperationFailure => e
            # Skip if duplicate key error from unique index
            next if e.message.include?("11000")
            raise
          end
        end
      end
    end
  end
end
