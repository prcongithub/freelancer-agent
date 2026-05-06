class UploadsController < ApplicationController
  # POST /:proto_id/uploads
  def create
    file     = params[:file]
    render json: { error: "No file provided" }, status: :bad_request and return unless file

    proto_id  = params[:proto_id]
    ext       = File.extname(file.original_filename).downcase
    key       = "proto-uploads/#{proto_id}/#{SecureRandom.uuid}#{ext}"
    bucket    = ENV.fetch("S3_PROTOTYPE_BUCKET", "freelancing-prototypes")
    region    = ENV.fetch("AWS_REGION", "us-east-1")

    s3 = Aws::S3::Client.new(
      region:            region,
      access_key_id:     ENV.fetch("AWS_ACCESS_KEY_ID"),
      secret_access_key: ENV.fetch("AWS_SECRET_ACCESS_KEY")
    )

    s3.put_object(
      bucket:       bucket,
      key:          key,
      body:         file.read,
      content_type: file.content_type,
      acl:          "public-read"
    )

    url = "https://#{bucket}.s3.#{region}.amazonaws.com/#{key}"
    render json: { url: url }, status: :created
  rescue Aws::S3::Errors::ServiceError => e
    Rails.logger.error("Upload failed: #{e.message}")
    render json: { error: "Upload failed" }, status: :internal_server_error
  end
end
