module Api
  module V1
    module Client
      class AnalysesController < ApplicationController
        before_action { require_role!(:client, :super_admin) }

        def show
          ca = ClientAnalysis.find_by(id: params[:id], client_user_id: @current_user_id)
          return render json: { error: "Not found" }, status: :not_found unless ca

          render json: {
            analysis: {
              id:                    ca.id.to_s,
              project_freelancer_id: ca.project_freelancer_id,
              shortlist:             ca.shortlist,
              analyzed_at:           ca.analyzed_at
            }
          }
        end
      end
    end
  end
end
