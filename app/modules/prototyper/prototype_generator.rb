module Prototyper
  class PrototypeGenerator
    include BedrockCaller

    CATEGORY_HINTS = {
      "frontend"      => "Build a full UI with working navigation, multiple pages/views, and all data operations wired to the API.",
      "fullstack"     => "Build a full UI with working navigation, multiple pages/views, and all data operations wired to the API.",
      "ai_automation" => "Build a chat interface or workflow UI. Simulate streaming AI responses by fetching from /:proto_id/messages and animating the text display.",
      "backend"       => "Build a clean API Explorer UI (Swagger-style) listing all available endpoints with example request/response panels. Include a live 'Try it' button.",
      "aws_devops"    => "Build an infrastructure dashboard UI showing mock AWS resource statuses, cost metrics, and deployment pipeline stages."
    }.freeze

    def generate(project_data)
      prompt = build_prompt(project_data)
      html   = call_bedrock(prompt, max_tokens: 8000, temperature: 0.5)

      unless valid_html?(html)
        html = call_bedrock(build_simple_prompt(project_data), max_tokens: 8000, temperature: 0.5)
        raise "Malformed HTML after retry" unless valid_html?(html)
      end

      html
    end

    def upload_to_s3(html, proto_id)
      bucket = ENV.fetch("S3_PROTOTYPE_BUCKET", "freelancing-prototypes")
      key    = "prototypes/#{proto_id}/index.html"
      region = ENV.fetch("AWS_BEDROCK_REGION", "us-east-1")

      client = Aws::S3::Client.new(
        region:            region,
        access_key_id:     ENV.fetch("AWS_BEDROCK_ACCESS_KEY_ID"),
        secret_access_key: ENV.fetch("AWS_BEDROCK_SECRET_ACCESS_KEY")
      )

      client.put_object(
        bucket:       bucket,
        key:          key,
        body:         html,
        content_type: "text/html",
        acl:          "public-read"
      )

      cf_base = ENV.fetch("CLOUDFRONT_PROTOTYPE_URL", "")
      if cf_base.present?
        "#{cf_base}/prototypes/#{proto_id}/index.html"
      else
        "https://#{bucket}.s3.#{region}.amazonaws.com/#{key}"
      end
    end

    private

    def build_prompt(project_data)
      proto_id      = project_data[:proto_id]
      proto_url     = project_data[:proto_api_url]
      category      = project_data[:category] || "fullstack"
      scope         = project_data.dig(:analysis, "scope") || project_data.dig(:analysis, :scope) || ""
      skills        = (project_data[:skills_required] || []).join(", ")
      category_hint = CATEGORY_HINTS[category] || CATEGORY_HINTS["fullstack"]

      <<~PROMPT
        You are building a working prototype for a Freelancer.com client.
        Return ONLY a complete, self-contained HTML file. No explanation, no markdown, no code fences.

        PROJECT:
        Title: #{project_data[:title]}
        Description: #{project_data[:description]&.slice(0, 600)}
        Scope: #{scope}
        Skills: #{skills}

        PROTOTYPE API:
        Base URL: #{proto_url}/#{proto_id}
        Available endpoints (call with fetch()):
          GET/POST  /#{proto_id}/:collection          (list/create documents)
          GET/PUT/DELETE /#{proto_id}/:collection/:id (get/update/delete one)
          POST /#{proto_id}/auth/register             ({ email, password } → { token })
          POST /#{proto_id}/auth/login                ({ email, password } → { token })
          GET  /#{proto_id}/auth/me                   (Bearer token → user)
          POST /#{proto_id}/uploads                   (multipart → { url })

        REQUIREMENTS:
        - Tailwind CSS CDN: <script src="https://cdn.tailwindcss.com"></script>
        - Alpine.js CDN: <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
        - On first load, seed 3-5 realistic sample documents via POST (use localStorage flag "seeded_#{proto_id}" to avoid re-seeding)
        - Professional design, mobile-responsive, looks like a real production app
        - Subtle watermark bottom-right: "⚡ Prototype by Prashant C."
        - Handle API errors gracefully
        - #{category_hint}

        Return the complete HTML file starting with <!DOCTYPE html>.
      PROMPT
    end

    def build_simple_prompt(project_data)
      proto_id  = project_data[:proto_id]
      proto_url = project_data[:proto_api_url]

      <<~PROMPT
        Build a simple single-page CRUD app as a self-contained HTML file.
        Use Tailwind CDN and Alpine.js CDN.
        API base: #{proto_url}/#{proto_id}
        App name: #{project_data[:title]}
        Show a list from GET /#{proto_id}/items, add form, delete buttons.
        Watermark "⚡ Prototype by Prashant C." bottom-right.
        Return ONLY the HTML file starting with <!DOCTYPE html>.
      PROMPT
    end

    def valid_html?(html)
      html.to_s.include?("</html>")
    end
  end
end
