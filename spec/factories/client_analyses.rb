FactoryBot.define do
  factory :client_analysis do
    sequence(:project_freelancer_id) { |n| "project_#{n}" }
    client_user_id { FactoryBot.create(:user, :client).id.to_s }
    shortlist { [] }
  end
end
