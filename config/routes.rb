Rails.application.routes.draw do
  get "/health", to: "health#show"

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      resources :projects, only: [:index, :show] do
        member do
          post :approve_bid
          post :reject
          post :analyze
          post :prototype, to: "prototypes#create"
          get  :prototype, to: "prototypes#show"
        end
      end

      resources :prototypes, only: [] do
        member do
          post :approve
          post :reject
        end
      end

      resources :bids, only: [:index, :show]

      resource :settings, only: [:show, :update]

      get :dashboard, to: "dashboard#index"
    end
  end
end
