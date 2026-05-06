class CrudController < ApplicationController
  wrap_parameters false

  before_action :set_collection
  before_action :set_document, only: [:show, :update, :partial_update, :destroy]

  # GET /:proto_id/:collection
  def index
    docs = @col.find.limit(200).to_a.map { |d| serialize(d) }
    render json: docs
  end

  # POST /:proto_id/:collection
  def create
    doc = permitted_params.merge(
      "_id"        => BSON::ObjectId.new,
      "created_at" => Time.current.utc,
      "updated_at" => Time.current.utc
    )
    @col.insert_one(doc)
    render json: serialize(doc), status: :created
  end

  # GET /:proto_id/:collection/:id
  def show
    render json: serialize(@doc)
  end

  # PUT /:proto_id/:collection/:id
  def update
    updates = permitted_params.merge("updated_at" => Time.current.utc)
    @col.find(_id: @oid).update_one("$set" => updates)
    render json: serialize(@col.find(_id: @oid).first)
  end

  # PATCH /:proto_id/:collection/:id
  alias_method :partial_update, :update

  # DELETE /:proto_id/:collection/:id
  def destroy
    @col.find(_id: @oid).delete_one
    head :no_content
  end

  private

  def set_collection
    col_name = collection_name(params[:proto_id], params[:collection])
    @col     = mongo_collection(col_name)
  rescue ActionController::BadRequest => e
    render json: { error: e.message }, status: :bad_request
  end

  def set_document
    @oid = parse_object_id(params[:id])
    unless @oid
      render json: { error: "Invalid id format" }, status: :bad_request and return
    end
    @doc = @col.find(_id: @oid).first
    render json: { error: "Not found" }, status: :not_found unless @doc
  end

  def permitted_params
    params.except(:proto_id, :collection, :id, :controller, :action, :format).permit!.to_h
  end

  def serialize(doc)
    doc.transform_keys(&:to_s).tap { |d| d["id"] = d.delete("_id").to_s }
  end
end
