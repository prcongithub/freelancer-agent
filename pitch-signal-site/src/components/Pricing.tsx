import { CheckCircle2, ArrowRight, Sparkles, MessageSquare } from 'lucide-react'

const plans = [
  {
    name: 'Solo',
    price: '$49',
    period: '/month',
    description: 'For independent consultants and expert freelancers getting started.',
    features: [
      'Opportunity inbox',
      'Buyer signal scoring',
      'Pitch & proposal copilot',
      'Basic follow-up CRM',
      '100 AI actions / month',
    ],
    cta: 'Join Waitlist',
    popular: false,
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$99',
    period: '/month',
    description: 'For serious full-time freelancers and consultants with an active pipeline.',
    features: [
      'Everything in Solo, plus:',
      'Buyer intelligence briefs',
      'Case study & proof matching',
      'Revenue analytics dashboard',
      '500 AI actions / month',
    ],
    cta: 'Join Waitlist',
    popular: true,
    highlight: true,
  },
  {
    name: 'Studio',
    price: '$249',
    period: '/month',
    description: 'For boutique agencies and small teams managing shared pipeline.',
    features: [
      'Everything in Pro, plus:',
      'Team workspace',
      'Multiple service profiles',
      'Proposal review workflow',
      'Shared case study library',
      '2,000 AI actions / month',
    ],
    cta: 'Join Waitlist',
    popular: false,
    highlight: false,
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="section-label mb-4">Pricing</span>
          <h2 className="section-title mb-5">
            Straightforward pricing for every stage of your business.
          </h2>
          <p className="section-subtitle mx-auto">
            Early-access pricing. No contracts. No per-seat minimums. Cancel anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-start">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-7 flex flex-col ${
                plan.highlight
                  ? 'bg-gradient-to-b from-brand-600 to-brand-700 border-2 border-brand-500 shadow-2xl shadow-brand-600/25 scale-[1.02]'
                  : 'bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider bg-amber-400 text-amber-900 px-3 py-1 rounded-full shadow-sm">
                    <Sparkles className="w-3 h-3" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3
                  className={`text-base font-bold mb-1 ${
                    plan.highlight ? 'text-white/80' : 'text-slate-500'
                  }`}
                >
                  {plan.name}
                </h3>
                <div className="flex items-end gap-1 mb-3">
                  <span
                    className={`text-4xl font-bold tracking-tight ${
                      plan.highlight ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {plan.price}
                  </span>
                  <span
                    className={`text-sm mb-1.5 ${
                      plan.highlight ? 'text-white/60' : 'text-slate-400'
                    }`}
                  >
                    {plan.period}
                  </span>
                </div>
                <p
                  className={`text-sm leading-relaxed ${
                    plan.highlight ? 'text-white/75' : 'text-slate-500'
                  }`}
                >
                  {plan.description}
                </p>
              </div>

              <ul className="space-y-2.5 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className={`w-4 h-4 mt-0.5 shrink-0 ${
                        plan.highlight ? 'text-brand-200' : 'text-brand-500'
                      }`}
                    />
                    <span
                      className={`text-sm leading-relaxed ${
                        plan.highlight ? 'text-white/85' : 'text-slate-600'
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="#waitlist"
                className={`inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  plan.highlight
                    ? 'bg-white text-brand-700 hover:bg-brand-50'
                    : 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm'
                }`}
              >
                {plan.cta}
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          ))}
        </div>

        {/* Enterprise CTA */}
        <div className="max-w-3xl mx-auto mt-10">
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 sm:p-8 flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center">
            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-slate-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-slate-900 mb-0.5">
                Need help setting up your revenue system?
              </h4>
              <p className="text-sm text-slate-500">
                Ask about managed onboarding for agencies and teams who want a done-with-you setup.
              </p>
            </div>
            <a
              href="mailto:hello@pitchsignal.io"
              className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all shadow-sm"
            >
              Request Onboarding
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
