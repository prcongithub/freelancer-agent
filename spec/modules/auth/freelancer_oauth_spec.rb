# spec/modules/auth/freelancer_oauth_spec.rb
require "rails_helper"

RSpec.describe Auth::FreelancerOAuth do
  describe ".authorize_url" do
    it "returns a Freelancer OAuth URL with role encoded in state" do
      url = described_class.authorize_url(role: "client")
      expect(url).to include("www.freelancer.com")
      expect(url).to include("response_type=code")
      expect(url).to include("state=")
      expect(url).to include("scope=")
    end
  end

  describe ".exchange_code" do
    it "exchanges code for token and returns user info with role" do
      stub_request(:post, "https://accounts.freelancer.com/oauth2/token")
        .to_return(
          status: 200,
          body: { access_token: "tok123", token_type: "bearer" }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      stub_request(:get, /freelancer\.com\/api\/users\/0\.1\/self/)
        .to_return(
          status: 200,
          body: { result: { id: 42, display_name: "Alice", email: "alice@example.com" } }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      state = Auth::TokenService.encode({ role: "client" }, exp: 10.minutes.from_now)
      result = described_class.exchange_code(code: "authcode", state: state)

      expect(result[:role]).to eq("client")
      expect(result[:access_token]).to eq("tok123")
      expect(result[:user_info]["id"]).to eq(42)
    end

    it "raises on invalid state token" do
      expect {
        described_class.exchange_code(code: "x", state: "bad.state.token")
      }.to raise_error(Auth::TokenService::InvalidToken)
    end
  end
end
