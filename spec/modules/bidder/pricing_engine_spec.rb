require "rails_helper"

RSpec.describe Bidder::PricingEngine do
  let(:engine) { described_class.new }

  describe "#calculate" do
    it "returns a pricing hash with required keys" do
      project = {
        category: "aws_devops",
        budget_range: { min: 1000, max: 3000 },
        description: "Set up ECS cluster with CI/CD pipeline and monitoring",
        fit_score: { agent_buildable: 30 }
      }

      result = engine.calculate(project)
      expect(result).to have_key(:amount)
      expect(result).to have_key(:hourly_rate)
      expect(result).to have_key(:estimated_hours)
      expect(result).to have_key(:discount_applied)
      expect(result[:amount]).to be > 0
    end

    it "uses category floor rates for aws_devops" do
      project = {
        category: "aws_devops",
        budget_range: { min: 1000, max: 5000 },
        description: "Complex AWS setup",
        fit_score: { agent_buildable: 10 }
      }

      result = engine.calculate(project)
      expect(result[:hourly_rate]).to be_between(75, 100)
    end

    it "applies discount for highly automatable projects" do
      automatable = {
        category: "frontend",
        budget_range: { min: 200, max: 2000 },
        description: "Build a simple landing page",
        fit_score: { agent_buildable: 90 }
      }

      manual = {
        category: "frontend",
        budget_range: { min: 200, max: 2000 },
        description: "Build a simple landing page",
        fit_score: { agent_buildable: 20 }
      }

      expect(engine.calculate(automatable)[:amount]).to be < engine.calculate(manual)[:amount]
    end

    it "caps bid at client max budget" do
      project = {
        category: "aws_devops",
        budget_range: { min: 100, max: 200 },
        description: "Very small AWS task",
        fit_score: { agent_buildable: 10 }
      }

      result = engine.calculate(project)
      expect(result[:amount]).to be <= 200
    end
  end
end
