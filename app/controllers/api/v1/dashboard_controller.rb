module Api
  module V1
    class DashboardController < ApplicationController
      def index
        render json: {
          pipeline:        pipeline_counts,
          stats:           stats,
          recent_projects: recent_projects
        }
      end

      private

      def pipeline_counts
        Project::STATUSES.each_with_object({}) do |status, hash|
          hash[status] = Project.with_status(status).count
        end
      end

      def stats
        won_bids   = Bid.where(status: "won")
        total_bids = Bid.where(:status.in => %w[won lost]).count

        {
          total_discovered: Project.count,
          total_bids:       Bid.count,
          bids_won:         won_bids.count,
          win_rate:         calculate_win_rate(won_bids.count, total_bids),
          total_revenue:    won_bids.sum(:amount).to_f
        }
      end

      def calculate_win_rate(won, total)
        return 0.0 if total.zero?
        ((won.to_f / total) * 100).round(1)
      end

      def recent_projects
        Project.order(discovered_at: :desc).limit(10).map do |p|
          {
            id:        p.id.to_s,
            title:     p.title,
            status:    p.status,
            fit_score: p.fit_score,
            category:  p.category
          }
        end
      end
    end
  end
end
