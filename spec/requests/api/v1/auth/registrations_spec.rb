require "rails_helper"

RSpec.describe "POST /api/v1/auth/registrations", type: :request do
  let(:valid_params) do
    { email: "jane@example.com", password: "password123", password_confirmation: "password123", role: "freelancer" }
  end

  context "with valid params" do
    it "creates a user and returns a JWT" do
      expect {
        post "/api/v1/auth/registrations", params: valid_params, as: :json
      }.to change(User, :count).by(1)

      expect(response).to have_http_status(:created)
      json = JSON.parse(response.body)
      expect(json["token"]).to be_present
      expect(json["role"]).to eq("freelancer")

      payload = Auth::TokenService.decode(json["token"])
      expect(payload["role"]).to eq("freelancer")
    end

    it "creates user with provider: local" do
      post "/api/v1/auth/registrations", params: valid_params, as: :json
      user = User.find_by(email: "jane@example.com")
      expect(user.provider).to eq("local")
      expect(user.provider_uid).to eq("jane@example.com")
    end
  end

  context "with invalid role" do
    it "rejects super_admin role" do
      post "/api/v1/auth/registrations",
           params: valid_params.merge(role: "super_admin"), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  context "with mismatched passwords" do
    it "returns 422" do
      post "/api/v1/auth/registrations",
           params: valid_params.merge(password_confirmation: "wrong"), as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  context "with duplicate email" do
    it "returns 422" do
      User.create!(provider: "local", provider_uid: "jane@example.com",
                   role: "freelancer", name: "Jane", email: "jane@example.com",
                   password: "password123")
      post "/api/v1/auth/registrations", params: valid_params, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  context "with client role" do
    it "creates a client user" do
      post "/api/v1/auth/registrations",
           params: valid_params.merge(role: "client"), as: :json
      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body)["role"]).to eq("client")
    end
  end
end
