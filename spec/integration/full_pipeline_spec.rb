require "rails_helper"

# Integration test: stubs Freelancer HTTP API, runs real scanner + scorer,
# then verifies project appears in the REST API and dashboard.
RSpec.describe "Full Pipeline Integration", type: :request do
  # A realistic Freelancer API response for an AWS/DevOps project.
  # Scores ~82 total (well above the 60 threshold).
  let(:freelancer_project_payload) do
    {
      result: {
        projects: [
          {
            id: 99_001,
            title: "AWS ECS + Docker deployment pipeline needed",
            preview_description: "We need an experienced AWS/DevOps engineer to set up an " \
                                  "ECS Fargate pipeline with Docker, Terraform, and CloudFront. " \
                                  "Must include CI/CD, auto-scaling, and CloudWatch monitoring. " \
                                  "Requires AWS, Docker, Terraform, and Kubernetes knowledge.",
            budget: { minimum: 1_500, maximum: 5_000 },
            currency: { code: "USD" },
            jobs: [
              { name: "AWS" },
              { name: "Docker" },
              { name: "Terraform" },
              { name: "Kubernetes" }
            ],
            owner_id: 55_001,
            owner_details: {
              reputation: { entire_history: { overall: 4.8 } },
              status: { payment_verified: true }
            },
            time_submitted: Time.current.to_i
          }
        ]
      },
      status: "success"
    }.to_json
  end

  before do
    # Stub every call to the Freelancer projects endpoint.
    # ScanJob iterates 5 keyword groups; the first match creates the project,
    # subsequent calls are deduplicated by the rescue block in ScanJob.
    stub_request(:get, /freelancer\.com\/api\/projects\/0\.1\/projects\/active/)
      .to_return(
        status: 200,
        body: freelancer_project_payload,
        headers: { "Content-Type" => "application/json" }
      )
  end

  describe "ScanJob discovers and stores a high-scoring project" do
    it "creates exactly one project with correct attributes" do
      expect { Scanner::ScanJob.new.perform }.to change(Project, :count).by(1)

      project = Project.find_by(freelancer_id: "99001")
      expect(project).not_to be_nil
      expect(project.status).to eq("discovered")
      expect(project.title).to eq("AWS ECS + Docker deployment pipeline needed")
      expect(project.fit_score["total"]).to be > 60
      expect(project.category).to eq("aws_devops")
      expect(project.discovered_at).not_to be_nil
    end

    it "project appears in GET /api/v1/projects" do
      Scanner::ScanJob.new.perform

      get "/api/v1/projects", headers: freelancer_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["projects"].length).to eq(1)
      expect(json["projects"][0]["freelancer_id"]).to eq("99001")
      expect(json["projects"][0]["status"]).to eq("discovered")
    end

    it "project is filterable by status in GET /api/v1/projects" do
      Scanner::ScanJob.new.perform

      get "/api/v1/projects", params: { status: "bid_sent" }, headers: freelancer_headers
      json = JSON.parse(response.body)
      expect(json["projects"]).to be_empty

      get "/api/v1/projects", params: { status: "discovered" }, headers: freelancer_headers
      json = JSON.parse(response.body)
      expect(json["projects"].length).to eq(1)
    end

    it "dashboard pipeline counts reflect the discovered project" do
      Scanner::ScanJob.new.perform

      get "/api/v1/dashboard", headers: freelancer_headers

      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      expect(json["pipeline"]["discovered"]).to eq(1)
      expect(json["stats"]["total_discovered"]).to eq(1)
      expect(json["recent_projects"].length).to eq(1)
    end

    it "running ScanJob twice does not create duplicate projects" do
      Scanner::ScanJob.new.perform
      expect { Scanner::ScanJob.new.perform }.not_to change(Project, :count)
    end
  end
end
