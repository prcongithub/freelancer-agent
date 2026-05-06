module AuthHelpers
  def jwt_headers(role: "freelancer", user_id: "test_user_id")
    token = Auth::TokenService.encode(user_id: user_id, role: role)
    { "Authorization" => "Bearer #{token}" }
  end

  def freelancer_headers
    jwt_headers(role: "freelancer")
  end

  def client_headers(user_id: "test_client_id")
    jwt_headers(role: "client", user_id: user_id)
  end

  def admin_headers
    jwt_headers(role: "super_admin")
  end
end
