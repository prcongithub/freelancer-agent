module Api
  module V1
    module Auth
      class RegistrationsController < ApplicationController
        skip_before_action :authenticate_user!, raise: false

        def create
          unless %w[freelancer client].include?(params[:role])
            render json: { error: "Role must be freelancer or client" }, status: :unprocessable_entity
            return
          end

          unless params[:password] == params[:password_confirmation]
            render json: { error: "Passwords do not match" }, status: :unprocessable_entity
            return
          end

          email = params[:email].to_s.downcase.strip
          user  = User.new(
            provider:     "local",
            provider_uid: email,
            role:         params[:role],
            name:         params[:name].presence || email.split("@").first.capitalize,
            email:        email,
            password:     params[:password]
          )

          if user.save
            token = ::Auth::TokenService.encode(user_id: user.id.to_s, role: user.role)
            render json: { token: token, role: user.role, name: user.name }, status: :created
          else
            render json: { error: user.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        end
      end
    end
  end
end
