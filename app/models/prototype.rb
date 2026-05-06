class Prototype
  include Mongoid::Document
  include Mongoid::Timestamps

  field :project_id,   type: String
  field :proto_id,     type: String
  field :status,       type: String, default: "generating"
  field :public_url,   type: String
  field :s3_key,       type: String
  field :generated_at, type: Time
  field :approved_at,  type: Time

  STATUSES = %w[generating ready failed approved rejected].freeze

  validates :project_id, presence: true
  validates :status, inclusion: { in: STATUSES }
  validates :proto_id, presence: true, uniqueness: true

  index({ project_id: 1 })
  index({ proto_id: 1 }, { unique: true })

  scope :by_project, ->(id) { where(project_id: id.to_s) }
  scope :approved,   -> { where(status: "approved") }

  before_validation :assign_proto_id, on: :create

  private

  def assign_proto_id
    self.proto_id ||= SecureRandom.alphanumeric(6).downcase
  end
end
