require "rails_helper"

RSpec.describe Scanner::ProjectScorer do
  let(:scorer) { described_class.new }

  describe "#score" do
    it "returns a score hash with total between 0-100" do
      project = {
        title: "Build AWS ECS deployment pipeline",
        description: "Need a CI/CD pipeline with Docker, ECS, and Terraform",
        budget_range: { min: 1000, max: 3000, currency: "USD" },
        skills_required: ["AWS", "Docker", "Terraform", "CI/CD"],
        client: { rating: 4.8, payment_verified: true }
      }

      result = scorer.score(project)
      expect(result[:total]).to be_between(0, 100)
      expect(result).to have_key(:skill_match)
      expect(result).to have_key(:budget)
      expect(result).to have_key(:scope_clarity)
      expect(result).to have_key(:agent_buildable)
      expect(result).to have_key(:client_quality)
    end

    it "scores higher for projects with more skill matches" do
      high_match = {
        title: "Rails + React + AWS project",
        description: "Full stack app with deployment",
        budget_range: { min: 2000, max: 5000, currency: "USD" },
        skills_required: ["Ruby on Rails", "React", "AWS", "Docker"],
        client: { rating: 4.5, payment_verified: true }
      }

      low_match = {
        title: "iOS Swift app",
        description: "Build an iPhone app",
        budget_range: { min: 2000, max: 5000, currency: "USD" },
        skills_required: ["Swift", "iOS", "Xcode"],
        client: { rating: 4.5, payment_verified: true }
      }

      expect(scorer.score(high_match)[:total]).to be > scorer.score(low_match)[:total]
    end
  end
end
