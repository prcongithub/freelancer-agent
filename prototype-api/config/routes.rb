Rails.application.routes.draw do
  get "/health", to: proc { [200, { "Content-Type" => "text/plain" }, ["ok"]] }

  scope "/:proto_id" do
    # Auth (handled by AuthController — to be added in Task 8)
    scope "/auth" do
      post "/register", to: "auth#register"
      post "/login",    to: "auth#login"
      get  "/me",       to: "auth#me"
    end

    # File uploads (handled by UploadsController — to be added in Task 9)
    post "/uploads", to: "uploads#create"

    # Generic CRUD
    get    "/:collection",     to: "crud#index"
    post   "/:collection",     to: "crud#create"
    get    "/:collection/:id", to: "crud#show"
    put    "/:collection/:id", to: "crud#update"
    patch  "/:collection/:id", to: "crud#partial_update"
    delete "/:collection/:id", to: "crud#destroy"

    # Namespace wipe
    delete "/", to: "namespace#destroy"
  end
end
