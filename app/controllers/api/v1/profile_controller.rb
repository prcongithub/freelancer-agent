module Api
  module V1
    class ProfileController < ApplicationController
      def show
        render json: { profile: serialize_profile(current_user) }
      end

      def update
        allowed = params.permit(:oauth_token, :freelancer_user_id, :name)
        if current_user.update(allowed)
          render json: { profile: serialize_profile(current_user) }
        else
          render json: { error: current_user.errors.full_messages.join(", ") },
                 status: :unprocessable_entity
        end
      end

      private

      def serialize_profile(user)
        {
          id:                  user.id.to_s,
          name:                user.name,
          email:               user.email,
          role:                user.role,
          freelancer_user_id:  user.freelancer_user_id,
          has_api_token:       user.oauth_token.present?
        }
      end
    end
  end
end
