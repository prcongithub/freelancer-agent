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
      category   = project[:category] || "fullstack"
      rates      = CATEGORY_RATES[category] || CATEGORY_RATES["fullstack"]
      hourly_rate      = ((rates[:min] + rates[:max]) / 2.0).round
      estimated_hours  = estimate_hours(project)
      base_amount      = hourly_rate * estimated_hours

      agent_score = (project.dig(:fit_score, :agent_buildable) || 0).to_f
      discount    = agent_score >= AGENT_DISCOUNT_THRESHOLD ? AGENT_DISCOUNT_PERCENT : 0.0

      final_amount = (base_amount * (1 - discount)).round

      max_budget = project.dig(:budget_range, :max).to_f
      final_amount = [final_amount, max_budget].min if max_budget > 0

      {
        amount:           final_amount,
        hourly_rate:      hourly_rate,
        estimated_hours:  estimated_hours,
        discount_applied: discount
      }
    end

    private

    def estimate_hours(project)
      max_budget = project.dig(:budget_range, :max).to_f
      if max_budget <= 200
        rand(3..8)
      elsif max_budget <= 500
        rand(5..12)
      elsif max_budget <= 2000
        rand(15..30)
      elsif max_budget <= 5000
        rand(30..60)
      else
        rand(60..100)
      end
    end
  end
end
