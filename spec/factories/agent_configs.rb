FactoryBot.define do
  factory :agent_config do
    agent  { 'scanner' }
    config { {} }
  end
end
