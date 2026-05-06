class User
  include Mongoid::Document
  include Mongoid::Timestamps
  include ActiveModel::SecurePassword

  ROLES = %w[freelancer client super_admin].freeze

  field :provider,            type: String
  field :provider_uid,        type: String
  field :oauth_token,         type: String
  field :oauth_token_secret,  type: String
  field :role,                type: String
  field :name,                type: String
  field :email,               type: String
  field :avatar_url,          type: String
  field :freelancer_user_id,  type: String
  field :password_digest,     type: String

  has_secure_password validations: false

  validates :provider,     presence: true
  validates :provider_uid, presence: true, uniqueness: { scope: :provider }
  validates :role,         presence: true, inclusion: { in: ROLES }
  validates :name,         presence: true
  validates :email,        format: { with: URI::MailTo::EMAIL_REGEXP }, allow_blank: true
  validates :password,     presence: true, length: { minimum: 8 }, if: :local?

  index({ provider: 1, provider_uid: 1 }, { unique: true })
  index({ role: 1 })
  index({ email: 1 })

  def local?
    provider == "local"
  end
end
