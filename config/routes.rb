Rails.application.routes.draw do
  get "/health", to: "health#show"
  get "up" => "rails/health#show", as: :rails_health_check

  namespace :api do
    namespace :v1 do
      namespace :auth do
        get  "freelancer/authorize", to: "freelancer#authorize"
        get  "freelancer/callback",  to: "freelancer#callback"
        get  "me",                   to: "sessions#me"
        post "sessions",             to: "sessions#create"
        post "registrations",        to: "registrations#create"
      end

      resources :projects, only: [:index, :show] do
        member do
          post :approve_bid
          post :reject
          post :analyze
        end
      end

      resources :projects, only: [] do
        member do
          post :prototype,  to: "prototypes#create"
          get  :prototype,  to: "prototypes#show"
        end
      end

      resources :prototypes, only: [] do
        member do
          post :approve, to: "prototypes#approve"
          post :reject,  to: "prototypes#reject"
        end
      end

      resources :bids, only: [:index, :show]
      resource  :settings, only: [:show, :update]
      resource  :profile,  only: [:show, :update], controller: "profile"
      get       :dashboard, to: "dashboard#index"

      namespace :client do
        resources :projects, only: [:index] do
          member do
            post :analyze_bids
          end
        end
        resources :analyses, only: [:show]
      end

      namespace :admin do
        resources :users, only: [:index, :update]
        get :stats, to: "stats#index"
      end
    end
  end
end
