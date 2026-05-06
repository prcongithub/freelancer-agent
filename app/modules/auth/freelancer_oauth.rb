# app/modules/auth/freelancer_oauth.rb
module Auth
  class FreelancerOAuth
    AUTH_URL      = "https://accounts.freelancer.com/oauth2/authorize"
    TOKEN_URL     = "https://accounts.freelancer.com/oauth2/token"
    USERINFO_URL  = "https://www.freelancer.com/api/users/0.1/self"

    def self.authorize_url(role:)
      state = Auth::TokenService.encode({ role: role }, exp: 10.minutes.from_now)
      params = {
        client_id:     ENV.fetch("FREELANCER_CLIENT_ID", ""),
        redirect_uri:  ENV.fetch("FREELANCER_OAUTH_REDIRECT_URI", ""),
        response_type: "code",
        scope:         "basic",
        state:         state
      }
      "#{AUTH_URL}?#{params.to_query}"
    end

    def self.exchange_code(code:, state:)
      role_payload = Auth::TokenService.decode(state)
      role = role_payload["role"]

      access_token = fetch_access_token(code)
      user_info    = fetch_user_info(access_token)

      { role: role, access_token: access_token, user_info: user_info }
    end

    def self.fetch_access_token(code)
      conn = Faraday.new do |f|
        f.request :url_encoded
        f.response :json
      end
      response = conn.post(TOKEN_URL) do |req|
        req.body = {
          grant_type:    "authorization_code",
          code:          code,
          redirect_uri:  ENV.fetch("FREELANCER_OAUTH_REDIRECT_URI", ""),
          client_id:     ENV.fetch("FREELANCER_CLIENT_ID", ""),
          client_secret: ENV.fetch("FREELANCER_CLIENT_SECRET", "")
        }
      end
      raise "Token exchange failed: #{response.status}" unless response.success?
      response.body["access_token"]
    end

    def self.fetch_user_info(access_token)
      conn = Faraday.new do |f|
        f.response :json
        f.headers["Freelancer-OAuth-V1"] = access_token
      end
      response = conn.get(USERINFO_URL, { compact: true })
      raise "Token exchange failed: #{response.status}" unless response.success?
      response.body["result"] || {}
    end
  end
end
