require "rails_helper"

RSpec.describe Project, type: :model do
  describe "validations" do
    it "requires freelancer_id" do
      project = Project.new(title: "Test")
      expect(project).not_to be_valid
      expect(project.errors[:freelancer_id]).to include("can't be blank")
    end

    it "requires unique freelancer_id" do
      Project.create!(freelancer_id: "123", title: "First")
      project = Project.new(freelancer_id: "123", title: "Second")
      expect(project).not_to be_valid
    end
  end

  describe "scopes" do
    it ".above_threshold returns projects with total score >= threshold" do
      Project.create!(freelancer_id: "1", title: "High", fit_score: { "total" => 80 })
      Project.create!(freelancer_id: "2", title: "Low", fit_score: { "total" => 40 })
      expect(Project.above_threshold(60).count).to eq(1)
    end
  end
end
