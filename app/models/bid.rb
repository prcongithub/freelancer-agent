class Bid
  include Mongoid::Document
  include Mongoid::Timestamps

  belongs_to :project

  field :amount, type: Float
  field :currency, type: String, default: "USD"
  field :proposal_text, type: String
  field :pricing_breakdown, type: Hash, default: {}
  field :status, type: String, default: "draft"
  field :submitted_at, type: Time
  field :freelancer_bid_id, type: String

  STATUSES = %w[draft submitted viewed shortlisted won lost].freeze

  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :project, presence: true
  validates :status, inclusion: { in: STATUSES }

  index({ project_id: 1 })
  index({ status: 1 })
  index({ submitted_at: -1 })
end
