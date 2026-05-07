module Api
  module V1
    module Admin
      class AgentsController < ApplicationController
        before_action { require_role!(:super_admin) }

        def index
          configs = AgentConfig::AGENTS.map do |agent|
            serialize(AgentConfig.for(agent))
          end
          render json: { agents: configs }
        end

        def show
          return render json: { error: "Unknown agent" }, status: :not_found unless AgentConfig::AGENTS.include?(params[:agent])
          render json: { agent: serialize(AgentConfig.for(params[:agent])) }
        end

        def update
          return render json: { error: "Unknown agent" }, status: :not_found unless AgentConfig::AGENTS.include?(params[:agent])
          cfg = AgentConfig.for(params[:agent])
          new_config = params.require(:config).to_unsafe_h
          if cfg.update(config: new_config)
            render json: { agent: serialize(cfg) }
          else
            render json: { error: cfg.errors.full_messages.join(", ") }, status: :unprocessable_entity
          end
        rescue ActionController::ParameterMissing
          render json: { error: "config param is required" }, status: :unprocessable_entity
        end

        private

        def serialize(cfg)
          { agent: cfg.agent, config: cfg.config, updated_at: cfg.updated_at }
        end
      end
    end
  end
end
