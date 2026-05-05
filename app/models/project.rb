class Project
  include Mongoid::Document
  include Mongoid::Timestamps

  field :freelancer_id, type: String
  field :title, type: String
  field :description, type: String
  field :budget_range, type: Hash
  field :skills_required, type: Array, default: []
  field :client, type: Hash
  field :fit_score, type: Hash, default: {}
  field :status, type: String, default: "discovered"
  field :category, type: String
  field :discovered_at, type: Time
  field :bid_at, type: Time
  field :won_at, type: Time
  field :delivered_at, type: Time

  STATUSES = %w[discovered bid_sent shortlisted won in_call prd_ready building deployed delivered lost].freeze
  CATEGORIES = %w[aws_devops backend frontend fullstack ai_automation].freeze

  validates :freelancer_id, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :category, inclusion: { in: CATEGORIES }, allow_nil: true

  scope :above_threshold, ->(threshold) { where("fit_score.total" => { "$gte" => threshold }) }
  scope :with_status, ->(status) { where(status: status) }
  scope :pending_bid_approval, -> { where(status: "discovered").above_threshold(60) }

  index({ freelancer_id: 1 }, { unique: true })
  index({ status: 1 })
  index({ "fit_score.total" => -1 })
end
