module Scanner
  class ProjectScorer
    SKILL_KEYWORDS = {
      aws_devops: %w[aws ec2 s3 lambda rds ecs eks cloudfront docker kubernetes terraform devops jenkins],
      backend: ["ruby on rails", "rails", "node.js", "nodejs", "express", "python", "rest", "microservices", "backend"],
      frontend: %w[react angular typescript javascript html css frontend dashboard ui],
      ai_automation: %w[ai openai claude gpt chatbot rag automation agent n8n],
      fullstack: ["full stack", "fullstack", "web application", "saas", "webapp"]
    }.freeze

    def score(project)
      skill_match = score_skill_match(project)
      budget = score_budget(project)
      scope_clarity = score_scope_clarity(project)
      agent_buildable = score_agent_buildable(project)
      client_quality = score_client_quality(project)

      total = (
        skill_match * 0.35 +
        budget * 0.20 +
        scope_clarity * 0.20 +
        agent_buildable * 0.10 +
        client_quality * 0.15
      ).round

      {
        total: total,
        skill_match: skill_match,
        budget: budget,
        scope_clarity: scope_clarity,
        agent_buildable: agent_buildable,
        client_quality: client_quality
      }
    end

    def categorize(project)
      skills_text = (project[:skills_required] || []).map(&:downcase).join(" ")
      title_text = (project[:title] || "").downcase
      combined = "#{skills_text} #{title_text}"

      scores = SKILL_KEYWORDS.map do |category, keywords|
        matches = keywords.count { |kw| combined.include?(kw) }
        [category, matches]
      end.to_h

      best = scores.max_by { |_, v| v }
      best[1] > 0 ? best[0].to_s : nil
    end

    private

    def score_skill_match(project)
      # Only match against skills_required — description text is too noisy
      skills_text = (project[:skills_required] || []).map(&:downcase).join(" ")
      all_keywords = SKILL_KEYWORDS.values.flatten
      matches = all_keywords.count { |kw| skills_text.include?(kw) }
      [(matches.to_f / 4 * 100).round, 100].min
    end

    def score_budget(project)
      budget_usd = CurrencyConverter.budget_max_usd(project[:budget_range] || {})
      return 20 if budget_usd < 100
      return 50 if budget_usd < 500
      return 70 if budget_usd < 1000
      return 85 if budget_usd < 5000
      100
    end

    def score_scope_clarity(project)
      desc = "#{project[:title]} #{project[:description]}"
      # Length: up to 60 points (600+ chars = full marks)
      length_score = [[desc.length / 10, 60].min, 0].max
      # Tech skills: 40 points if 2+ skills match our known keyword set
      skills_text = (project[:skills_required] || []).map(&:downcase).join(" ")
      all_keywords = SKILL_KEYWORDS.values.flatten
      tech_skill_count = all_keywords.count { |kw| skills_text.include?(kw) }
      has_tech_skills = tech_skill_count >= 2 ? 40 : (tech_skill_count == 1 ? 20 : 0)
      [length_score + has_tech_skills, 100].min
    end

    def score_agent_buildable(project)
      desc = "#{project[:title]} #{project[:description]}".downcase
      simple_indicators = %w[landing page crud dashboard api bot simple basic]
      complex_indicators = %w[enterprise migration legacy existing codebase refactor]

      simple_count = simple_indicators.count { |w| desc.include?(w) }
      complex_count = complex_indicators.count { |w| desc.include?(w) }

      base = 50
      base += simple_count * 15
      base -= complex_count * 20
      [[base, 100].min, 0].max
    end

    def score_client_quality(project)
      client = project[:client] || {}
      score = 50
      rating = client[:rating].to_f
      score += (rating - 3) * 20 if rating > 0
      score += 20 if client[:payment_verified]
      [[score, 100].min, 0].max
    end
  end
end
