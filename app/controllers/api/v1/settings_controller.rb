module Api
  module V1
    class SettingsController < ApplicationController
      def show
        render json: { settings: serialize_settings(Setting.instance) }
      end

      def update
        setting = Setting.instance
        setting.update!(setting_params)
        render json: { settings: serialize_settings(setting) }
      rescue Mongoid::Errors::Validations => e
        render json: { error: e.message }, status: :unprocessable_content
      end

      private

      def setting_params
        params.permit(
          :auto_bid_threshold,
          :approval_threshold,
          skill_keywords: {},
          pricing_floors: {},
          notifications: {}
        )
      end

      def serialize_settings(s)
        {
          auto_bid_threshold: s.auto_bid_threshold,
          approval_threshold: s.approval_threshold,
          skill_keywords: s.skill_keywords,
          pricing_floors: s.pricing_floors,
          notifications: s.notifications
        }
      end
    end
  end
end
