module Api
  module V1
    module Admin
      class AgentsController < ApplicationController
        before_action { require_role!(:super_admin) }

        ALLOWED_AGENTS = AgentConfig::AGENTS.freeze

        def index
          configs = ALLOWED_AGENTS.map do |agent|
            serialize(AgentConfig.for(agent))
          end
          render json: { agents: configs }
        end

        def show
          return render json: { error: "Unknown agent" }, status: :not_found unless ALLOWED_AGENTS.include?(params[:agent])
          render json: { agent: serialize(AgentConfig.for(params[:agent])) }
        end

        def update
          return render json: { error: "Unknown agent" }, status: :not_found unless ALLOWED_AGENTS.include?(params[:agent])
          cfg = AgentConfig.for(params[:agent])
          cfg.update!(config: params.require(:config).to_unsafe_h)
          render json: { agent: serialize(cfg) }
        end

        private

        def serialize(cfg)
          { agent: cfg.agent, config: cfg.config, updated_at: cfg.updated_at }
        end
      end
    end
  end
end
