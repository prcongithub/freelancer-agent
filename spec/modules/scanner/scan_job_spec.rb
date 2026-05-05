require "rails_helper"

RSpec.describe Scanner::ScanJob do
  describe "#perform" do
    let(:client) { instance_double(Scanner::FreelancerClient) }
    let(:scorer) { instance_double(Scanner::ProjectScorer) }

    before do
      allow(Scanner::FreelancerClient).to receive(:new).and_return(client)
      allow(Scanner::ProjectScorer).to receive(:new).and_return(scorer)
    end

    it "creates a project when score is above threshold" do
      project_data = {
        freelancer_id: "111",
        title: "Build React Dashboard",
        description: "Need a React developer",
        budget_range: { min: 500, max: 2000, currency: "USD" },
        skills_required: ["React", "AWS"],
        client: { id: "999", rating: 4.5, payment_verified: true }
      }

      allow(client).to receive(:search_projects).and_return([project_data])
      allow(scorer).to receive(:score).and_return({ total: 80, skill_match: 80, budget: 70, scope_clarity: 60, agent_buildable: 50, client_quality: 75 })
      allow(scorer).to receive(:categorize).and_return("fullstack")

      expect {
        described_class.new.perform
      }.to change(Project, :count).by(1)

      project = Project.find_by(freelancer_id: "111")
      expect(project.status).to eq("discovered")
      expect(project.category).to eq("fullstack")
    end

    it "skips projects below threshold" do
      project_data = {
        freelancer_id: "222",
        title: "Simple task",
        description: "Quick job",
        budget_range: { min: 10, max: 50, currency: "USD" },
        skills_required: ["PHP"],
        client: { id: "888" }
      }

      allow(client).to receive(:search_projects).and_return([project_data])
      allow(scorer).to receive(:score).and_return({ total: 30, skill_match: 20, budget: 20, scope_clarity: 20, agent_buildable: 50, client_quality: 50 })
      allow(scorer).to receive(:categorize).and_return(nil)

      expect {
        described_class.new.perform
      }.not_to change(Project, :count)
    end

    it "does not create duplicate projects" do
      project_data = {
        freelancer_id: "333",
        title: "Build API",
        description: "REST API needed",
        budget_range: { min: 500, max: 2000, currency: "USD" },
        skills_required: ["Node.js", "AWS"],
        client: { id: "777" }
      }

      allow(client).to receive(:search_projects).and_return([project_data])
      allow(scorer).to receive(:score).and_return({ total: 80, skill_match: 80, budget: 70, scope_clarity: 60, agent_buildable: 50, client_quality: 50 })
      allow(scorer).to receive(:categorize).and_return("backend")

      described_class.new.perform
      expect {
        described_class.new.perform
      }.not_to change(Project, :count)
    end
  end
end
