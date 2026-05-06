class ApplicationController < ActionController::API
  private

  def collection_name(proto_id, name)
    safe = name.to_s.gsub(/[^a-zA-Z0-9_]/, "").first(40)
    raise ActionController::BadRequest, "Invalid collection name" if safe.blank?
    "#{proto_id}_#{safe}"
  end

  def mongo_collection(col_name)
    Mongoid.client(:default)[col_name]
  end

  def parse_object_id(id)
    BSON::ObjectId(id)
  rescue BSON::Error::InvalidObjectId
    nil
  end
end
