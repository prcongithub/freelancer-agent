module Analyzer
  class AnalyzeJob
    include Sidekiq::Job
    sidekiq_options queue: :default, retry: 2

    def perform(project_id)
      project = Project.find(project_id)
      return if project.analysis.present?

      result = ProjectAnalyzer.new.analyze(project)
      return unless result

      project.update!(analysis: result, analyzed_at: Time.current)
    rescue Mongoid::Errors::DocumentNotFound
      Rails.logger.warn("Analyzer::AnalyzeJob: project #{project_id} not found")
    end
  end
end
