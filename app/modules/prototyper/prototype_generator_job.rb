module Prototyper
  class PrototypeGeneratorJob
    include Sidekiq::Job
    sidekiq_options queue: :default, retry: 2

    def perform(prototype_id)
      prototype = Prototype.find(prototype_id)
      project   = Project.find(prototype.project_id)

      generator = PrototypeGenerator.new

      project_data = {
        title:           project.title,
        description:     project.description,
        category:        project.category,
        skills_required: project.skills_required,
        analysis:        project.analysis,
        proto_id:        prototype.proto_id,
        proto_api_url:   ENV.fetch("PROTO_API_PUBLIC_URL", "http://localhost:3001")
      }

      html       = generator.generate(project_data)
      public_url = generator.upload_to_s3(html, prototype.proto_id)

      prototype.update!(
        status:       "ready",
        public_url:   public_url,
        s3_key:       "prototypes/#{prototype.proto_id}/index.html",
        generated_at: Time.current
      )
    rescue => e
      Rails.logger.error("PrototypeGeneratorJob failed for #{prototype_id}: #{e.class}: #{e.message}")
      Prototype.where(id: prototype_id).update_all("$set" => { status: "failed" })
      raise
    end
  end
end
