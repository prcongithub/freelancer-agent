# spec/modules/auth/token_service_spec.rb
require "rails_helper"

RSpec.describe Auth::TokenService do
  describe ".encode / .decode" do
    it "encodes and decodes a payload" do
      token = described_class.encode(user_id: "abc123", role: "client")
      payload = described_class.decode(token)
      expect(payload["user_id"]).to eq("abc123")
      expect(payload["role"]).to eq("client")
    end

    it "raises InvalidToken for a blank token" do
      expect { described_class.decode("") }.to raise_error(Auth::TokenService::InvalidToken)
    end

    it "raises InvalidToken for a tampered token" do
      expect { described_class.decode("not.a.jwt") }.to raise_error(Auth::TokenService::InvalidToken)
    end

    it "raises InvalidToken for an expired token" do
      token = described_class.encode({ user_id: "x", role: "freelancer" }, exp: 1.second.ago)
      expect { described_class.decode(token) }.to raise_error(Auth::TokenService::InvalidToken)
    end
  end
end
