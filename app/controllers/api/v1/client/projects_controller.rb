module Api
  module V1
    module Client
      class ProjectsController < ApplicationController
        before_action { require_role!(:client, :super_admin) }

        def index
          fl = ClientPortal::FreelancerClient.new(current_user.oauth_token)
          projects = fl.list_projects
          render json: { projects: projects }
        end

        def analyze_bids
          fl = ClientPortal::FreelancerClient.new(current_user.oauth_token)
          projects = fl.list_projects
          project = projects.find { |p| p[:freelancer_id] == params[:id] }

          return render json: { error: "Project not found" }, status: :not_found unless project

          ClientPortal::AnalyzeBidsJob.perform_async(
            @current_user_id,
            project.transform_keys(&:to_s)
          )
          render json: { message: "Bid analysis queued" }
        end
      end
    end
  end
end
