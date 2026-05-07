import {
  Download,
  Star,
  Search,
  Award,
  PenLine,
  CalendarClock,
  TrendingUp,
  Users,
  ArrowRight,
} from 'lucide-react'

const steps = [
  {
    icon: Download,
    step: '01',
    title: 'Capture opportunities',
    description: 'Bring in leads from marketplaces, LinkedIn, email, referrals, communities, and manual entries.',
    color: 'text-brand-500',
    bg: 'bg-brand-50',
    border: 'border-brand-100',
  },
  {
    icon: Star,
    step: '02',
    title: 'Score fit and buyer intent',
    description: 'Evaluate urgency, budget fit, service match, deal size potential, and red flags in seconds.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
  },
  {
    icon: Search,
    step: '03',
    title: 'Research the buyer',
    description: 'Generate context-rich briefs with company background, decision context, pains, and personalization hooks.',
    color: 'text-sky-500',
    bg: 'bg-sky-50',
    border: 'border-sky-100',
  },
  {
    icon: Award,
    step: '04',
    title: 'Recommend the right proof',
    description: 'Match each opportunity with your most relevant case studies, portfolio items, and outcome metrics.',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  {
    icon: PenLine,
    step: '05',
    title: 'Draft sharper pitches',
    description: 'Create first responses, discovery questions, proposal outlines, and pricing options grounded in your actual work.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    icon: CalendarClock,
    step: '06',
    title: 'Track follow-ups',
    description: 'Never let a promising conversation go cold. Stay on top of pipeline movement with a lightweight follow-up system.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
  },
  {
    icon: TrendingUp,
    step: '07',
    title: 'Learn what converts',
    description: 'Understand reply rates, close rates, revenue by channel, and which offers and pitches actually win.',
    color: 'text-teal-500',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
  },
  {
    icon: Users,
    step: '08',
    title: 'Help buyers evaluate fit',
    description: 'Buyer-side workflows let teams clarify requirements, compare vendor fit, and receive more relevant proposals.',
    color: 'text-indigo-500',
    bg: 'bg-indigo-50',
    border: 'border-indigo-100',
  },
]

export default function Solution() {
  return (
    <section id="solution" className="py-20 sm:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="section-label mb-4">The Solution</span>
          <h2 className="section-title mb-5">
            A revenue workspace built around buyer signals.
          </h2>
          <p className="section-subtitle mx-auto">
            PitchSignal connects every part of your sales workflow — from first signal to closed
            deal — in a single, focused workspace built for expert service businesses.
          </p>
        </div>

        {/* Flow grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-3">
          {steps.map(({ icon: Icon, step, title, description, color, bg, border }, i) => (
            <div key={title} className="relative">
              <div className="card h-full hover:border-slate-300">
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className={`w-9 h-9 rounded-lg ${bg} border ${border} flex items-center justify-center shrink-0`}
                  >
                    <Icon className={`w-4.5 h-4.5 ${color}`} size={18} />
                  </div>
                  <span className="text-xs font-bold text-slate-300 mt-2 font-mono">{step}</span>
                </div>
                <h3 className="text-sm font-semibold text-slate-900 mb-1.5">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
              </div>

              {/* Arrow connector (horizontal, except last in row) */}
              {i % 4 !== 3 && i !== steps.length - 1 && (
                <div className="hidden lg:flex absolute -right-2.5 top-1/2 -translate-y-1/2 z-10 w-5 h-5 items-center justify-center">
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
