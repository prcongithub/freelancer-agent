class Setting
  include Mongoid::Document
  include Mongoid::Timestamps

  field :skill_keywords, type: Hash, default: -> {
    {
      "aws_devops"    => %w[aws ec2 s3 lambda rds ecs eks cloudfront docker kubernetes terraform devops jenkins],
      "backend"       => ["ruby on rails", "rails", "node.js", "nodejs", "express", "python", "rest api", "microservices", "backend"],
      "frontend"      => %w[react angular typescript javascript html css frontend dashboard ui],
      "ai_automation" => %w[ai openai claude gpt chatbot rag automation agent n8n],
      "fullstack"     => ["full stack", "fullstack", "web application", "saas", "webapp"]
    }
  }

  field :pricing_floors, type: Hash, default: -> {
    {
      "aws_devops"    => { "min" => 75,  "max" => 100 },
      "ai_automation" => { "min" => 100, "max" => 120 },
      "fullstack"     => { "min" => 60,  "max" => 80  },
      "backend"       => { "min" => 60,  "max" => 80  },
      "frontend"      => { "min" => 40,  "max" => 60  }
    }
  }

  field :auto_bid_threshold,  type: Integer, default: 80
  field :approval_threshold,  type: Integer, default: 60
  field :notifications,       type: Hash,    default: { "email" => false, "dashboard" => true }

  validates :auto_bid_threshold,  numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
  validates :approval_threshold,  numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }

  def self.instance
    first || create!
  end

  def self.threshold
    instance.approval_threshold
  end
end
