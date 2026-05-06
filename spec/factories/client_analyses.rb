FactoryBot.define do
  factory :client_analysis do
    sequence(:project_freelancer_id) { |n| "project_#{n}" }
    sequence(:client_user_id) { |n| "client_user_#{n}" }
    shortlist { [] }
  end
end
