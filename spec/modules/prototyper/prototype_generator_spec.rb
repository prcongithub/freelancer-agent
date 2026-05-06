require 'rails_helper'

RSpec.describe Prototyper::PrototypeGenerator do
  let(:project_data) do
    {
      title: "Task Manager App",
      description: "A simple task management app with user auth",
      category: "fullstack",
      skills_required: ["React", "Node.js"],
      analysis: { "scope" => "CRUD app for tasks", "ai_advantage" => "Fast delivery" },
      proto_id: "abc123",
      proto_api_url: "http://localhost:3001"
    }
  end

  describe "#build_prompt" do
    it "includes proto_id in the prompt" do
      generator = described_class.new
      prompt = generator.send(:build_prompt, project_data)
      expect(prompt).to include("abc123")
    end

    it "includes the proto_api_url in the prompt" do
      generator = described_class.new
      prompt = generator.send(:build_prompt, project_data)
      expect(prompt).to include("http://localhost:3001")
    end

    it "includes fullstack category hint" do
      generator = described_class.new
      prompt = generator.send(:build_prompt, project_data)
      expect(prompt).to include("full UI")
    end

    it "includes ai_automation hint for ai_automation category" do
      generator = described_class.new
      data = project_data.merge(category: "ai_automation")
      prompt = generator.send(:build_prompt, data)
      expect(prompt).to include("chat interface")
    end
  end

  describe "#valid_html?" do
    it "returns true for valid HTML" do
      generator = described_class.new
      expect(generator.send(:valid_html?, "<html><body>hi</body></html>")).to be true
    end

    it "returns false for truncated HTML" do
      generator = described_class.new
      expect(generator.send(:valid_html?, "<html><body>truncated")).to be false
    end
  end
end
