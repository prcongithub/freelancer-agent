module BedrockCaller
  DEFAULT_MODEL = "global.anthropic.claude-haiku-4-5-20251001-v1:0".freeze

  def call_bedrock(prompt, system_prompt: nil, max_tokens: 1024, temperature: 0.3)
    client = Aws::BedrockRuntime::Client.new(
      region:            ENV.fetch("AWS_BEDROCK_REGION", "us-east-1"),
      access_key_id:     ENV.fetch("AWS_BEDROCK_ACCESS_KEY_ID"),
      secret_access_key: ENV.fetch("AWS_BEDROCK_SECRET_ACCESS_KEY")
    )

    params = {
      model_id:         ENV.fetch("BEDROCK_MODEL_ID", DEFAULT_MODEL),
      messages:         [{ role: "user", content: [{ text: prompt }] }],
      inference_config: { max_tokens: max_tokens, temperature: temperature }
    }
    params[:system] = [{ text: system_prompt }] if system_prompt

    response = client.converse(**params)
    text = response.output.message.content.first.text
    text.gsub(/\A```(?:html|json)?\n?/, "").gsub(/\n?```\z/, "").strip
  end
end
