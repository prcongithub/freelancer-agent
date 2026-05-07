module CurrencyConverter
  # Approximate rates: how many units of foreign currency = 1 USD
  RATES = {
    "USD" => 1.0,
    "INR" => 84.0,
    "EUR" => 0.92,
    "GBP" => 0.79,
    "AUD" => 1.55,
    "CAD" => 1.38,
    "NZD" => 1.65,
    "SGD" => 1.35,
    "PKR" => 278.0,
    "BDT" => 110.0,
    "PHP" => 56.0,
    "MYR" => 4.7,
    "NGN" => 1600.0
  }.freeze

  def self.to_usd(amount, currency)
    rate = RATES[currency.to_s.upcase] || 1.0
    (amount.to_f / rate).round(2)
  end

  def self.from_usd(amount_usd, currency)
    rate = RATES[currency.to_s.upcase] || 1.0
    (amount_usd.to_f * rate).round(2)
  end

  # Returns USD equivalent of the budget max
  def self.budget_max_usd(budget_range)
    max      = (budget_range.dig(:max) || budget_range.dig("max")).to_f
    currency = budget_range.dig(:currency) || budget_range.dig("currency") || "USD"
    to_usd(max, currency)
  end

  def self.currency_for(budget_range)
    budget_range.dig(:currency) || budget_range.dig("currency") || "USD"
  end
end
