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

    def perform
      client = FreelancerClient.new
      scorer = ProjectScorer.new

      KEYWORD_GROUPS.each do |_category, keywords|
        projects = client.search_projects(keywords: keywords)

        projects.each do |project_data|
          score = scorer.score(project_data)
          category = scorer.categorize(project_data)

          threshold = 60
          threshold = Setting.threshold if defined?(Setting) && Setting.respond_to?(:threshold)
          next if score[:total] < threshold

          begin
            Project.create!(
              freelancer_id: project_data[:freelancer_id],
              title: project_data[:title],
              description: project_data[:description],
              budget_range: project_data[:budget_range],
              skills_required: project_data[:skills_required],
              client: project_data[:client],
              fit_score: score,
              category: category,
              status: "discovered",
              discovered_at: Time.current
            )
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
