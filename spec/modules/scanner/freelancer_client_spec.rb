require "rails_helper"

RSpec.describe Scanner::FreelancerClient do
  let(:client) { described_class.new }

  describe "#search_projects" do
    it "returns parsed projects from Freelancer API" do
      stub_request(:get, /www\.freelancer\.com\/api\/projects\/0\.1\/projects\/active/)
        .to_return(
          status: 200,
          body: {
            result: {
              projects: [
                {
                  id: 12345,
                  title: "Build AWS Infrastructure",
                  preview_description: "Need help setting up ECS cluster",
                  budget: { minimum: 500, maximum: 1000 },
                  currency: { code: "USD" },
                  jobs: [{ name: "AWS" }, { name: "Docker" }],
                  owner_id: 999,
                  time_submitted: 1714900000
                }
              ]
            }
          }.to_json,
          headers: { "Content-Type" => "application/json" }
        )

      projects = client.search_projects(keywords: ["aws"])
      expect(projects.length).to eq(1)
      expect(projects.first[:freelancer_id]).to eq("12345")
      expect(projects.first[:title]).to eq("Build AWS Infrastructure")
      expect(projects.first[:skills_required]).to eq(["AWS", "Docker"])
    end
  end
end
