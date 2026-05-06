class User
  include Mongoid::Document
  include Mongoid::Timestamps

  ROLES = %w[freelancer client super_admin].freeze

  field :provider,            type: String
  field :provider_uid,        type: String
  field :oauth_token,         type: String
  # For OAuth 1.0 providers only (Freelancer.com uses OAuth 2.0 — optional)
  field :oauth_token_secret,  type: String
  field :role,                type: String
  field :name,                type: String
  field :email,               type: String
  field :avatar_url,          type: String

  validates :provider,     presence: true
  validates :provider_uid, presence: true, uniqueness: { scope: :provider }
  validates :role,         presence: true, inclusion: { in: ROLES }
  validates :name,         presence: true
  validates :email,        format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true

  index({ provider: 1, provider_uid: 1 }, { unique: true })
  index({ role: 1 })
  index({ email: 1 })
end
