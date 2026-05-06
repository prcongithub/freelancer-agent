module Api
  module V1
    module Auth
      class SessionsController < ApplicationController
        def me
          user = current_user
          fresh_token = ::Auth::TokenService.encode(user_id: user.id.to_s, role: user.role)
          render json: {
            token: fresh_token,
            user: { id: user.id.to_s, name: user.name, role: user.role, avatar_url: user.avatar_url }
          }
        end
      end
    end
  end
end
