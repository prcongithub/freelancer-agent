module Api
  module V1
    class BidsController < ApplicationController
      def index
        bids = Bid.all.includes(:project).order(submitted_at: :desc)
        bids = bids.where(status: params[:status]) if params[:status].present?

        render json: { bids: bids.map { |b| serialize_bid(b) } }
      end

      def show
        bid = Bid.find(params[:id])
        render json: { bid: serialize_bid(bid) }
      rescue Mongoid::Errors::DocumentNotFound
        render json: { error: "Bid not found" }, status: :not_found
      end

      private

      def serialize_bid(bid)
        {
          id: bid.id.to_s,
          project_id: bid.project_id.to_s,
          project_title: bid.project.title,
          amount: bid.amount,
          currency: bid.currency,
          proposal_text: bid.proposal_text,
          pricing_breakdown: bid.pricing_breakdown,
          status: bid.status,
          submitted_at: bid.submitted_at,
          freelancer_bid_id: bid.freelancer_bid_id
        }
      end
    end
  end
end
