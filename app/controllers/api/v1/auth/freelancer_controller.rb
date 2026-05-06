module Api
  module V1
    module Auth
      class FreelancerController < ApplicationController
        skip_before_action :authenticate_user!, raise: false

        def authorize
          role = params[:role].presence_in(%w[freelancer client]) || "freelancer"
          url  = ::Auth::FreelancerOAuth.authorize_url(role: role)
          render json: { url: url }
        end

        def callback
          result = ::Auth::FreelancerOAuth.exchange_code(
            code:  params[:code],
            state: params[:state]
          )

          user = User.find_or_initialize_by(
            provider:     "freelancer",
            provider_uid: result[:user_info]["id"].to_s
          )

          if user.new_record?
            user.role       = result[:role]
            user.name       = result[:user_info]["display_name"] || "Unknown"
            user.email      = result[:user_info]["email"]
            user.avatar_url = result[:user_info]["avatar_cdn"]
          end

          user.oauth_token = result[:access_token]
          user.save!

          token = ::Auth::TokenService.encode(user_id: user.id.to_s, role: user.role)
          redirect_to "#{ENV.fetch("FRONTEND_URL", "http://localhost:5173")}/auth/callback?token=#{token}",
                      allow_other_host: true
        rescue ::Auth::TokenService::InvalidToken => e
          render json: { error: "Invalid OAuth state: #{e.message}" }, status: :bad_request
        rescue => e
          Rails.logger.error("OAuth callback error: #{e.class}: #{e.message}")
          redirect_to "#{ENV.fetch("FRONTEND_URL", "http://localhost:5173")}/login?error=oauth_failed",
                      allow_other_host: true
        end
      end
    end
  end
end
