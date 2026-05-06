class UploadsController < ApplicationController
  MAX_FILE_SIZE = 10 * 1024 * 1024 # 10 MB

  ALLOWED_EXTENSIONS = {
    ".jpg"  => "image/jpeg",
    ".jpeg" => "image/jpeg",
    ".png"  => "image/png",
    ".gif"  => "image/gif",
    ".webp" => "image/webp",
    ".pdf"  => "application/pdf",
    ".zip"  => "application/zip",
    ".txt"  => "text/plain",
    ".csv"  => "text/csv"
  }.freeze

  # POST /:proto_id/uploads
  def create
    file = params[:file]
    render json: { error: "No file provided" }, status: :bad_request and return unless file

    render json: { error: "File too large (max 10 MB)" }, status: :unprocessable_entity and return if file.size > MAX_FILE_SIZE

    ext          = File.extname(file.original_filename.to_s).downcase
    content_type = ALLOWED_EXTENSIONS[ext]
    render json: { error: "File type not allowed" }, status: :unprocessable_entity and return unless content_type

    safe_proto_id = params[:proto_id].to_s.gsub(/[^a-zA-Z0-9_-]/, "")[0, 40]
    key           = "proto-uploads/#{safe_proto_id}/#{SecureRandom.uuid}#{ext}"
    bucket        = ENV.fetch("S3_PROTOTYPE_BUCKET", "freelancing-prototypes")
    region        = ENV.fetch("AWS_REGION", "us-east-1")

    s3 = Aws::S3::Client.new(
      region:            region,
      access_key_id:     ENV.fetch("AWS_ACCESS_KEY_ID"),
      secret_access_key: ENV.fetch("AWS_SECRET_ACCESS_KEY")
    )

    s3.put_object(
      bucket:       bucket,
      key:          key,
      body:         file.read,
      content_type: content_type,
      acl:          "public-read"
    )

    url = "https://#{bucket}.s3.#{region}.amazonaws.com/#{key}"
    render json: { url: url }, status: :created
  rescue Aws::S3::Errors::ServiceError, KeyError => e
    Rails.logger.error("Upload failed: #{e.message}")
    render json: { error: "Upload failed" }, status: :internal_server_error
  end
end
