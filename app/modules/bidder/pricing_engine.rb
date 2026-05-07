module Bidder
  class PricingEngine
    CATEGORY_RATES = {
      "aws_devops"    => { min: 75,  max: 100 },
      "ai_automation" => { min: 100, max: 120 },
      "fullstack"     => { min: 60,  max: 80  },
      "backend"       => { min: 60,  max: 80  },
      "frontend"      => { min: 40,  max: 60  }
    }.freeze

    AGENT_DISCOUNT_THRESHOLD = 70
    AGENT_DISCOUNT_PERCENT   = 0.25

    def calculate(project)
      cfg      = AgentConfig.for("bidder").config
      db_rates = (cfg["category_rates"] || {}).transform_values { |v|
        { min: v["min"].to_i, max: v["max"].to_i }
      }
      rates_map          = db_rates.presence || CATEGORY_RATES
      discount_threshold = cfg.fetch("agent_discount_threshold", AGENT_DISCOUNT_THRESHOLD).to_f

      category    = project[:category] || "fullstack"
      rates       = rates_map[category] || rates_map["fullstack"] || CATEGORY_RATES["fullstack"]
      hourly_rate = ((rates[:min] + rates[:max]) / 2.0).round

      # Prefer Claude's AI-assisted effort_days estimate; fall back to budget-based (already AI-adjusted)
      effort_days     = project.dig(:analysis, "effort_days") || project.dig(:analysis, :effort_days)
      estimated_hours = effort_days ? (effort_days * 6).round : estimate_hours_from_budget(project)

      traditional_days = project.dig(:analysis, "traditional_effort_days") ||
                         project.dig(:analysis, :traditional_effort_days)

      base_amount = hourly_rate * estimated_hours

      agent_score = (project.dig(:fit_score, :agent_buildable) ||
                     project.dig(:fit_score, "agent_buildable") || 0).to_f
      discount    = agent_score >= discount_threshold ? AGENT_DISCOUNT_PERCENT : 0.0

      full_amount_usd = (base_amount * (1 - discount)).round

      budget_range    = project[:budget_range] || project["budget_range"] || {}
      max_budget_usd  = CurrencyConverter.budget_max_usd(budget_range)
      currency        = CurrencyConverter.currency_for(budget_range)

      # Cap at budget max (in USD), then convert final bid to project's currency
      within_budget   = max_budget_usd <= 0 || full_amount_usd <= max_budget_usd
      capped_usd      = within_budget ? full_amount_usd : max_budget_usd.round
      amount_native   = CurrencyConverter.from_usd(capped_usd, currency).round

      {
        amount:                amount_native,   # in project currency — for submission
        amount_usd:            capped_usd,      # always USD — for display
        full_amount_usd:       full_amount_usd,
        currency:              currency,
        within_budget:         within_budget,
        hourly_rate:           hourly_rate,
        estimated_hours:       estimated_hours,
        traditional_days:      traditional_days,
        ai_speedup:            traditional_days && effort_days ? (traditional_days.to_f / effort_days).round(1) : nil,
        discount_applied:      discount,
        rate_range:            rates
      }
    end

    private

    def estimate_hours_from_budget(project)
      # Use USD equivalent for thresholds (AI-assisted hours, ~4x faster)
      budget_usd = CurrencyConverter.budget_max_usd(project[:budget_range] || project["budget_range"] || {})
      if    budget_usd <= 200  then 2
      elsif budget_usd <= 500  then 4
      elsif budget_usd <= 2000 then 8
      elsif budget_usd <= 5000 then 16
      else                          32
      end
    end
  end
end
