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
end
