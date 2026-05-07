import { CheckCircle2, Briefcase, Building2 } from 'lucide-react'

const sellerBenefits = [
  'Know which opportunities deserve your time',
  'Understand buyer context before responding',
  'Match the right proof to each lead',
  'Write sharper, more relevant pitches',
  'Follow up consistently without a manual system',
  'Learn which channels and offers actually convert',
]

const buyerBenefits = [
  'Clarify project requirements before publishing',
  'Compare vendor fit more objectively',
  'Receive more relevant, contextualized proposals',
  'Reduce vague discovery calls that waste time',
  'Understand scope and pricing options earlier',
  'Choose better-fit partners with more confidence',
]

export default function TwoSided() {
  return (
    <section id="two-sided" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="section-label mb-4">Two-Sided Value</span>
          <h2 className="section-title mb-5">
            Built for service providers today. Useful for buyers tomorrow.
          </h2>
          <p className="section-subtitle mx-auto">
            PitchSignal starts as a revenue intelligence platform for service providers, with
            buyer-side workflows designed into the product vision from day one.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Seller side */}
          <div className="rounded-2xl border-2 border-brand-200 bg-gradient-to-br from-brand-50 to-violet-50 p-7">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-brand-600">
                  For Service Providers
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Freelancers & Agencies
                </div>
              </div>
            </div>

            <ul className="space-y-3">
              {sellerBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-700 leading-relaxed">{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <a
                href="#waitlist"
                className="inline-flex items-center gap-2 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                Join Waitlist
              </a>
            </div>
          </div>

          {/* Buyer side */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-7 relative overflow-hidden">
            {/* Coming soon ribbon */}
            <div className="absolute top-4 right-4">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-slate-200 text-slate-500 px-2.5 py-1 rounded-full border border-slate-300">
                Coming Soon
              </span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-slate-700 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  For Service Buyers
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  Companies & Startup Teams
                </div>
              </div>
            </div>

            <ul className="space-y-3">
              {buyerBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <span className="text-sm text-slate-600 leading-relaxed">{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <p className="text-xs text-slate-400 leading-relaxed">
                Buyer-side workflows are in the product roadmap. Designed to create better fit
                between buyers and service providers — not just better proposals.
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto mt-8 text-center">
          <p className="text-sm text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5">
            PitchSignal starts as a revenue intelligence platform for service providers, with
            buyer-side workflows designed into the product vision.
          </p>
        </div>
      </div>
    </section>
  )
}
