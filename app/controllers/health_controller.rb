class HealthController < ApplicationController
  skip_before_action :authenticate_user!, raise: false

  def show
    # Check MongoDB connection
    Mongoid.default_client.command(ping: 1)
    render json: { status: "ok" }, status: :ok
  rescue => e
    render json: { status: "error", message: e.message }, status: :service_unavailable
  end
end
