class ClientAnalysis
  include Mongoid::Document
  include Mongoid::Timestamps

  field :project_freelancer_id, type: String
  field :client_user_id,        type: String
  field :shortlist,             type: Array, default: []
  field :analyzed_at,           type: Time

  validates :project_freelancer_id, presence: true
  validates :client_user_id,        presence: true

  index({ project_freelancer_id: 1, client_user_id: 1 }, { unique: true })
  index({ client_user_id: 1 })
end
