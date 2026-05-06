# app/modules/auth/token_service.rb
module Auth
  class TokenService
    ALGORITHM = "HS256"

    class InvalidToken < StandardError; end

    def self.secret
      Rails.application.credentials.secret_key_base || ENV.fetch("SECRET_KEY_BASE")
    end

    def self.encode(payload = {}, exp: 7.days.from_now, **kwargs)
      data = payload.merge(kwargs).merge(exp: exp.to_i)
      JWT.encode(data, secret, ALGORITHM)
    end

    def self.decode(token)
      raise InvalidToken, "No token provided" if token.blank?
      decoded = JWT.decode(token, secret, true, { algorithm: ALGORITHM })
      decoded.first.with_indifferent_access
    rescue JWT::DecodeError => e
      raise InvalidToken, e.message
    end
  end
end
