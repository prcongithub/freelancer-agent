require "rails_helper"

RSpec.describe Setting, type: :model do
  describe ".instance" do
    it "returns a persisted settings document" do
      setting = Setting.instance
      expect(setting).to be_persisted
    end

    it "returns the same document on subsequent calls (singleton)" do
      first  = Setting.instance
      second = Setting.instance
      expect(first.id).to eq(second.id)
    end
  end

  describe ".threshold" do
    it "returns approval_threshold (default 60)" do
      expect(Setting.threshold).to eq(60)
    end
  end

  describe "defaults" do
    it "defaults auto_bid_threshold to 80" do
      expect(Setting.instance.auto_bid_threshold).to eq(80)
    end

    it "defaults approval_threshold to 60" do
      expect(Setting.instance.approval_threshold).to eq(60)
    end

    it "has default skill_keywords for all categories" do
      keywords = Setting.instance.skill_keywords
      expect(keywords).to have_key("aws_devops")
      expect(keywords).to have_key("backend")
      expect(keywords).to have_key("frontend")
      expect(keywords).to have_key("ai_automation")
      expect(keywords).to have_key("fullstack")
    end

    it "has default pricing_floors for all categories" do
      floors = Setting.instance.pricing_floors
      expect(floors).to have_key("aws_devops")
      expect(floors).to have_key("ai_automation")
    end
  end
end
