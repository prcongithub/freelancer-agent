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
                by_status: begin
                  status_counts = Project.collection.aggregate([
                    { "$group" => { "_id" => "$status", "count" => { "$sum" => 1 } } }
                  ]).to_a.each_with_object({}) { |doc, h| h[doc["_id"]] = doc["count"] }
                  Project::STATUSES.index_with { |s| status_counts[s] || 0 }
                end
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
