import { UserCog, FolderInput, ScanSearch, LineChart, ArrowDown } from 'lucide-react'

const steps = [
  {
    icon: UserCog,
    number: '01',
    title: 'Define your sales profile',
    description:
      'Upload your service offers, case studies, past projects, preferred client profiles, pricing ranges, and communication tone. This becomes the foundation PitchSignal builds every analysis on.',
    details: ['Service offers & pricing ranges', 'Past projects & case studies', 'Preferred client profiles', 'Tone and communication style'],
  },
  {
    icon: FolderInput,
    number: '02',
    title: 'Capture opportunities',
    description:
      "Save leads from marketplaces, LinkedIn messages, email inquiries, referrals, communities, and websites — or enter them manually. Everything lands in one unified inbox.",
    details: ['Freelance marketplaces', 'LinkedIn & email', 'Referrals & communities', 'Manual & website entries'],
  },
  {
    icon: ScanSearch,
    number: '03',
    title: 'Read the buyer signals',
    description:
      "PitchSignal scores the opportunity, researches the buyer, identifies intent signals, flags risks, recommends the most relevant proof, and prepares a pitch angle — before you've written a single word.",
    details: ['Fit score & intent analysis', 'Buyer intelligence brief', 'Case study matching', 'Pitch angle recommendation'],
  },
  {
    icon: LineChart,
    number: '04',
    title: 'Track, follow up, and improve',
    description:
      'Manage follow-up timing, monitor pipeline movement, and build a clear picture of which channels, offers, and pitch styles actually drive revenue for your service business.',
    details: ['Follow-up reminders', 'Pipeline visibility', 'Revenue attribution', 'Conversion analytics'],
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="section-label mb-4">How It Works</span>
          <h2 className="section-title mb-5">
            From first signal to closed deal — in four steps.
          </h2>
          <p className="section-subtitle mx-auto">
            PitchSignal fits into how expert service businesses already work. No complex onboarding.
            No reinventing your sales motion.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-4">
          {steps.map(({ icon: Icon, number, title, description, details }, i) => (
            <div key={title}>
              <div className="flex gap-5 sm:gap-7 items-start p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition-all duration-200 group">
                {/* Step number + icon */}
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 flex items-center justify-center shadow-lg shadow-brand-600/20 group-hover:scale-105 transition-transform">
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-xs font-bold text-slate-300 font-mono">{number}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-3">{description}</p>
                  <div className="flex flex-wrap gap-2">
                    {details.map((detail) => (
                      <span
                        key={detail}
                        className="text-xs font-medium text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-full"
                      >
                        {detail}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Arrow between steps */}
              {i < steps.length - 1 && (
                <div className="flex justify-center my-1">
                  <ArrowDown className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
