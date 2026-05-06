module Api
  module V1
    class PrototypesController < ApplicationController
      # POST /api/v1/projects/:id/prototype
      def create
        project = Project.find(params[:id])

        existing = Prototype.by_project(project.id)
                            .not_in(status: ["failed", "rejected"])
                            .first
        if existing
          render json: { prototype: serialize(existing) }, status: :accepted
          return
        end

        prototype = Prototype.create!(project_id: project.id.to_s, status: "generating")
        Prototyper::PrototypeGeneratorJob.perform_async(prototype.id.to_s)
        render json: { prototype: serialize(prototype) }, status: :accepted
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Project not found" }, status: :not_found
      end

      # GET /api/v1/projects/:id/prototype
      def show
        project   = Project.find(params[:id])
        prototype = Prototype.by_project(project.id).order(created_at: :desc).first

        if prototype.nil?
          render json: { error: "No prototype" }, status: :not_found
          return
        end

        render json: { prototype: serialize(prototype) }
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Project not found" }, status: :not_found
      end

      # POST /api/v1/prototypes/:id/approve
      def approve
        prototype = Prototype.find(params[:id])
        prototype.update!(status: "approved", approved_at: Time.current)
        render json: { prototype: serialize(prototype) }
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Prototype not found" }, status: :not_found
      end

      # POST /api/v1/prototypes/:id/reject
      def reject
        prototype = Prototype.find(params[:id])
        prototype.update!(status: "rejected")
        render json: { prototype: serialize(prototype) }
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Prototype not found" }, status: :not_found
      end

      private

      def serialize(prototype)
        {
          id:           prototype.id.to_s,
          project_id:   prototype.project_id,
          proto_id:     prototype.proto_id,
          status:       prototype.status,
          public_url:   prototype.public_url,
          approved:     prototype.status == "approved",
          generated_at: prototype.generated_at,
          approved_at:  prototype.approved_at,
          created_at:   prototype.created_at
        }
      end
    end
  end
end
