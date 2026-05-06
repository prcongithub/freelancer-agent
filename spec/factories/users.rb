FactoryBot.define do
  factory :user do
    provider     { "freelancer" }
    sequence(:provider_uid) { |n| "uid_#{n}" }
    oauth_token  { "test_token_#{SecureRandom.hex(8)}" }
    name         { Faker::Name.name }
    email        { Faker::Internet.email }
    role         { "freelancer" }

    trait :client do
      role { "client" }
    end

    trait :super_admin do
      role { "super_admin" }
    end
  end
end
