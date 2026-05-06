class ApplicationController < ActionController::API
  before_action :authenticate_user!
  rescue_from Mongoid::Errors::DocumentNotFound, with: :not_found

  private

  def authenticate_user!
    token = request.headers["Authorization"]&.split(" ")&.last
    payload = Auth::TokenService.decode(token)
    @current_user_id = payload["user_id"]
    @current_role    = payload["role"]
  rescue Auth::TokenService::InvalidToken
    render json: { error: "Unauthorized" }, status: :unauthorized
  end

  def require_role!(*roles)
    return if roles.map(&:to_s).include?(@current_role)
    render json: { error: "Forbidden" }, status: :forbidden
  end

  def current_user
    @current_user ||= User.find(@current_user_id)
  rescue Mongoid::Errors::DocumentNotFound
    render json: { error: "Unauthorized" }, status: :unauthorized
  end

  def not_found
    render json: { error: "Not found" }, status: :not_found
  end
end
