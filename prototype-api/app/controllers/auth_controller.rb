class AuthController < ApplicationController
  before_action :authenticate!, only: [:me]

  # POST /:proto_id/auth/register
  def register
    col   = mongo_collection("#{params[:proto_id]}_users")
    email = params[:email].to_s.downcase.strip

    render json: { error: "Email required" }, status: :bad_request and return if email.blank?
    render json: { error: "Password required" }, status: :bad_request and return if params[:password].blank?
    render json: { error: "Email already taken" }, status: :conflict and return if col.find(email: email).first

    hashed = BCrypt::Password.create(params[:password])
    user   = { "_id" => BSON::ObjectId.new, "email" => email, "password_digest" => hashed,
               "created_at" => Time.current.utc }
    col.insert_one(user)

    render json: { token: encode_token(params[:proto_id], user["_id"].to_s, email),
                   user: { id: user["_id"].to_s, email: email } }, status: :created
  end

  # POST /:proto_id/auth/login
  def login
    col   = mongo_collection("#{params[:proto_id]}_users")
    email = params[:email].to_s.downcase.strip
    user  = col.find(email: email).first

    if user && BCrypt::Password.new(user["password_digest"]) == params[:password]
      render json: { token: encode_token(params[:proto_id], user["_id"].to_s, email),
                     user: { id: user["_id"].to_s, email: email } }
    else
      render json: { error: "Invalid credentials" }, status: :unauthorized
    end
  end

  # GET /:proto_id/auth/me
  def me
    render json: { user: @current_user }
  end

  private

  def encode_token(proto_id, user_id, email)
    secret = ENV.fetch("PROTO_JWT_SECRET")
    JWT.encode({ proto_id: proto_id, user_id: user_id, email: email, exp: 30.days.from_now.to_i },
               secret, "HS256")
  end

  def authenticate!
    header = request.headers["Authorization"]
    token  = header&.split(" ")&.last
    render json: { error: "Unauthorized" }, status: :unauthorized and return unless token

    secret  = ENV.fetch("PROTO_JWT_SECRET")
    payload = JWT.decode(token, secret, true, algorithms: ["HS256"]).first

    unless payload["proto_id"] == params[:proto_id]
      render json: { error: "Token proto_id mismatch" }, status: :unauthorized and return
    end

    col   = mongo_collection("#{params[:proto_id]}_users")
    @current_user = col.find("_id" => BSON::ObjectId(payload["user_id"])).first
    render json: { error: "User not found" }, status: :unauthorized and return unless @current_user
  rescue JWT::DecodeError
    render json: { error: "Invalid token" }, status: :unauthorized
  end
end
