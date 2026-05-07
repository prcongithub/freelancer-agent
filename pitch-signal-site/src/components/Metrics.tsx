import {
  TimerOff,
  Target,
  BellRing,
  Award,
  LineChart,
  RefreshCcw,
  MessageSquare,
} from 'lucide-react'

const outcomes = [
  {
    icon: TimerOff,
    title: 'Spend less time on bad-fit leads',
    description: 'Score and filter opportunities before investing in a response.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
  },
  {
    icon: Target,
    title: 'Improve pitch relevance',
    description: 'Grounded in buyer context and your actual past work — not templates.',
    color: 'text-brand-500',
    bg: 'bg-brand-50',
    border: 'border-brand-100',
  },
  {
    icon: BellRing,
    title: 'Follow up consistently',
    description: 'Structured reminders so promising deals never go cold.',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  {
    icon: Award,
    title: 'Reuse proof more effectively',
    description: 'Surface the most relevant case studies automatically, not as an afterthought.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    icon: LineChart,
    title: 'Understand winning channels',
    description: 'Know which sources of leads are actually worth your attention and budget.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
  },
  {
    icon: RefreshCcw,
    title: 'Build a repeatable sales motion',
    description: 'Replace ad-hoc outreach with a system that learns and improves over time.',
    color: 'text-sky-500',
    bg: 'bg-sky-50',
    border: 'border-sky-100',
  },
  {
    icon: MessageSquare,
    title: 'Help buyers receive clearer proposals',
    description: 'Better-qualified leads mean better proposals for everyone in the transaction.',
    color: 'text-teal-500',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
  },
]

const metrics = [
  { value: '42%', label: 'fewer low-fit proposals' },
  { value: '2.3x', label: 'faster sales prep' },
  { value: '18%', label: 'higher reply rate' },
  { value: '3.1x', label: 'more case study reuse' },
]

export default function Metrics() {
  return (
    <section id="metrics" className="py-20 sm:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="section-label mb-4">Outcomes</span>
          <h2 className="section-title mb-5">
            What a signal-driven sales workflow actually looks like.
          </h2>
          <p className="section-subtitle mx-auto">
            The goal is not to send more pitches. It is to send the right ones — and understand
            what&apos;s working.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {outcomes.map(({ icon: Icon, title, description, color, bg, border }) => (
            <div
              key={title}
              className="p-5 rounded-xl bg-white border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 group"
            >
              <div
                className={`w-9 h-9 rounded-lg ${bg} border ${border} flex items-center justify-center mb-3 group-hover:scale-105 transition-transform`}
              >
                <Icon className={`w-4.5 h-4.5 ${color}`} size={18} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1.5">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        {/* Metrics strip */}
        <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 border border-slate-700/60 p-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {metrics.map(({ value, label }) => (
              <div key={label} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent mb-1">
                  {value}
                </div>
                <div className="text-sm text-slate-400">{label}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-600 mt-6">
            Illustrative early-access metrics. Actual results vary by service type, market, and workflow adoption.
          </p>
        </div>
      </div>
    </section>
  )
}
