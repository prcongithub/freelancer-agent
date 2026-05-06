module Api
  module V1
    module Admin
      class StatsController < ApplicationController
        before_action { require_role!(:super_admin) }

        def index
          render json: {
            stats: {
              users: {
                total:       User.count,
                freelancers: User.where(role: "freelancer").count,
                clients:     User.where(role: "client").count
              },
              projects: {
                total:     Project.count,
                by_status: Project::STATUSES.index_with { |s| Project.where(status: s).count }
              },
              analyses: {
                total: ClientAnalysis.count
              }
            }
          }
        end
      end
    end
  end
end
