require "rails_helper"

RSpec.describe User, type: :model do
  it "is valid with required fields" do
    user = User.new(provider: "freelancer", provider_uid: "123", role: "client",
                    oauth_token: "tok", name: "Alice")
    expect(user).to be_valid
  end

  it "requires provider_uid uniqueness" do
    User.create!(provider: "freelancer", provider_uid: "123", role: "client",
                 oauth_token: "tok", name: "Alice")
    dup = User.new(provider: "freelancer", provider_uid: "123", role: "freelancer",
                   oauth_token: "tok2", name: "Bob")
    expect(dup).not_to be_valid
  end

  it "validates role is in allowed list" do
    user = User.new(provider: "freelancer", provider_uid: "456", role: "hacker",
                    oauth_token: "tok", name: "Eve")
    expect(user).not_to be_valid
  end

  it "has a valid factory" do
    expect(FactoryBot.build(:user)).to be_valid
  end

  it "requires provider" do
    user = User.new(provider_uid: "1", role: "freelancer", name: "Alice", oauth_token: "tok")
    expect(user).not_to be_valid
  end

  it "requires name" do
    user = User.new(provider: "freelancer", provider_uid: "1", role: "freelancer", oauth_token: "tok")
    expect(user).not_to be_valid
  end

  describe "freelancer_user_id field" do
    it "stores and retrieves freelancer_user_id" do
      user = User.new(
        provider: "local", provider_uid: "test@example.com",
        role: "freelancer", name: "Test", email: "test@example.com",
        password: "password123", freelancer_user_id: "2870829"
      )
      expect(user.freelancer_user_id).to eq("2870829")
    end
  end

  describe "local (super_admin) user" do
    subject(:user) do
      User.new(
        provider:     "local",
        provider_uid: "admin@example.com",
        role:         "super_admin",
        name:         "Admin",
        email:        "admin@example.com",
        password:     "securepass123"
      )
    end

    it "is valid with email and password" do
      expect(user).to be_valid
    end

    it "authenticates with correct password" do
      user.save!
      expect(user.authenticate("securepass123")).to eq(user)
    end

    it "rejects wrong password" do
      user.save!
      expect(user.authenticate("wrongpass")).to be_falsey
    end

    it "is invalid without password on create" do
      user.password = nil
      expect(user).not_to be_valid
    end
  end
end
