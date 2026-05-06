module Api
  module V1
    module Admin
      class UsersController < ApplicationController
        before_action { require_role!(:super_admin) }

        def index
          users = User.all.order(created_at: :desc)
          render json: { users: users.map { |u| serialize_user(u) } }
        end

        def update
          user = User.find(params[:id])
          new_role = params[:role]

          unless User::ROLES.include?(new_role)
            return render json: { error: "Invalid role" }, status: :unprocessable_content
          end

          user.update!(role: new_role)
          render json: { user: serialize_user(user) }
        rescue Mongoid::Errors::DocumentNotFound
          render json: { error: "User not found" }, status: :not_found
        end

        private

        def serialize_user(user)
          {
            id:         user.id.to_s,
            name:       user.name,
            email:      user.email,
            role:       user.role,
            provider:   user.provider,
            avatar_url: user.avatar_url,
            created_at: user.created_at
          }
        end
      end
    end
  end
end
