module Api
  module V1
    class ProjectsController < ApplicationController
      def index
        projects = Project.all
        projects = projects.with_status(params[:status]) if params[:status].present?
        projects = projects.order(discovered_at: :desc)

        render json: { projects: projects.map { |p| serialize_project(p) } }
      end

      def show
        project = Project.find(params[:id])
        render json: { project: serialize_project(project) }
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Project not found" }, status: :not_found
      end

      def approve_bid
        # Atomic: only update if status is currently "discovered"
        # update_all returns a Mongo::Operation::Update::Result; use .n for matched count
        result = Project.where(id: params[:id], status: "discovered")
                        .update_all("$set" => { status: "bid_sent", bid_at: Time.current.utc })

        if result.n == 0
          # Either not found or not in discovered state
          project = Project.find(params[:id]) rescue nil
          if project.nil?
            render json: { error: "Project not found" }, status: :not_found
          else
            render json: { error: "Project must be in discovered state" }, status: :unprocessable_content
          end
          return
        end

        Bidder::SubmitBidJob.perform_async(params[:id].to_s)
        render json: { message: "Bid submission queued" }
      end

      def reject
        result = Project.where(id: params[:id]).update_all("$set" => { status: "lost" })
        if result.n == 0
          render json: { error: "Project not found" }, status: :not_found
          return
        end
        project = Project.find(params[:id])
        render json: { project: serialize_project(project) }
      end

      private

      def serialize_project(project)
        {
          id: project.id.to_s,
          freelancer_id: project.freelancer_id,
          title: project.title,
          description: project.description,
          budget_range: project.budget_range,
          skills_required: project.skills_required,
          client: project.client,
          fit_score: project.fit_score,
          status: project.status,
          category: project.category,
          discovered_at: project.discovered_at,
          bid_at: project.bid_at,
          won_at: project.won_at,
          delivered_at: project.delivered_at
        }
      end
    end
  end
end
