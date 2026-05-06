class NamespaceController < ApplicationController
  # DELETE /:proto_id
  def destroy
    proto_id = params[:proto_id].to_s.gsub(/[^a-zA-Z0-9]/, "")
    return render json: { error: "Invalid proto_id" }, status: :bad_request if proto_id.blank?

    dropped = []
    Mongoid.client(:default).collections.each do |col|
      if col.name.start_with?("#{proto_id}_")
        col.drop
        dropped << col.name
      end
    end

    render json: { dropped: dropped }
  end
end
