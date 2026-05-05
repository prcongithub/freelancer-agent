require "rails_helper"

RSpec.describe Bidder::ProposalGenerator do
  let(:generator) { described_class.new }

  describe "#generate" do
    it "returns a proposal string using OpenAI API" do
      stub_request(:post, "https://api.openai.com/v1/chat/completions")
        .to_return(
          status: 200,
          body: {
            choices: [{
              message: {
                content: "I am excited to work on your AWS infrastructure project. I have extensive experience with ECS, Docker, and Terraform. Let me help you build a robust CI/CD pipeline that meets your requirements. I will deliver within your timeline and budget. Let's schedule a call to discuss."
              }
            }]
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      project = {
        title: "Build AWS ECS deployment pipeline",
        description: "Need CI/CD with Docker and ECS",
        skills_required: ["AWS", "Docker", "CI/CD"],
        budget_range: { min: 1000, max: 3000, currency: "USD" }
      }

      proposal = generator.generate(project)
      expect(proposal).to be_a(String)
      expect(proposal.length).to be > 50
    end

    it "returns a fallback proposal when OpenAI fails" do
      stub_request(:post, "https://api.openai.com/v1/chat/completions")
        .to_raise(Faraday::ConnectionFailed.new("connection refused"))

      project = {
        title: "Build React Dashboard",
        description: "Need React developer",
        skills_required: ["React", "TypeScript"],
        budget_range: { min: 500, max: 2000, currency: "USD" }
      }

      proposal = generator.generate(project)
      expect(proposal).to be_a(String)
      expect(proposal).to include("React Dashboard")
    end
  end
end
