class ApplicationController < ActionController::API
  class Unauthorized < StandardError; end
  class Forbidden    < StandardError; end

  rescue_from Unauthorized, with: -> { render json: { error: "Unauthorized" }, status: :unauthorized }
  rescue_from Forbidden,    with: -> { render json: { error: "Forbidden" },    status: :forbidden }
  rescue_from Mongoid::Errors::DocumentNotFound, with: -> { render json: { error: "Not found" }, status: :not_found }

  before_action :authenticate_user!

  private

  def authenticate_user!
    token = request.headers["Authorization"]&.split(" ")&.last
    payload = Auth::TokenService.decode(token)
    @current_user_id = payload["user_id"]
    @current_role    = payload["role"]
  rescue Auth::TokenService::InvalidToken
    raise Unauthorized
  end

  def require_role!(*roles)
    raise Forbidden unless roles.map(&:to_s).include?(@current_role)
  end

  def current_user
    @current_user ||= User.find(@current_user_id)
  rescue Mongoid::Errors::DocumentNotFound
    raise Unauthorized
  end
end
