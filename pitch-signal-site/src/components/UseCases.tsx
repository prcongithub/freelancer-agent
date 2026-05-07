import {
  Bot,
  Cloud,
  Code2,
  Megaphone,
  UserCheck,
  Lightbulb,
  SearchCode,
  Users2,
} from 'lucide-react'

const useCases = [
  {
    icon: Bot,
    title: 'AI Automation Agencies',
    description:
      'Identify buyers with genuine automation pain, qualify by operational complexity, and pitch with workflow-specific ROI examples from past implementations.',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
  },
  {
    icon: Cloud,
    title: 'DevOps & Cloud Consultants',
    description:
      'Score infrastructure pain signals, qualify by current stack and AWS spend, and lead with the right cost or reliability angle for each engagement.',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-100',
  },
  {
    icon: Code2,
    title: 'Software Development Boutiques',
    description:
      'Distinguish serious product builds from spec-fishing, match the right team background to each opportunity, and price confidently with comparable past projects.',
    color: 'text-brand-600',
    bg: 'bg-brand-50',
    border: 'border-brand-100',
  },
  {
    icon: Megaphone,
    title: 'Marketing Automation Agencies',
    description:
      'Detect buyer readiness to invest in infrastructure versus campaigns, and tailor pitches around attribution, pipeline, and revenue outcomes instead of vanity metrics.',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
  },
  {
    icon: UserCheck,
    title: 'Fractional Executives',
    description:
      'Qualify companies by stage, org maturity, and functional readiness so you only engage where a fractional model genuinely fits and can deliver measurable impact.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    icon: Lightbulb,
    title: 'Independent Consultants',
    description:
      "Stop guessing which projects are worth a proposal. Understand buyer context before you respond, and close more of the deals that align with your best work.",
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  {
    icon: SearchCode,
    title: 'Startup Founders Evaluating Vendors',
    description:
      'Clarify what you actually need before reaching out, compare vendor fit by criteria that matter, and receive proposals calibrated to your actual stage and constraints.',
    color: 'text-teal-600',
    bg: 'bg-teal-50',
    border: 'border-teal-100',
  },
  {
    icon: Users2,
    title: 'Business Teams Sourcing Partners',
    description:
      'Reduce the noise of vendor selection by surfacing the most relevant service providers based on project requirements, budget, and expected outcomes.',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
    border: 'border-indigo-100',
  },
]

export default function UseCases() {
  return (
    <section id="use-cases" className="py-20 sm:py-28 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="section-label mb-4">Use Cases</span>
          <h2 className="section-title mb-5">
            Built for expert service businesses — and the buyers who need them.
          </h2>
          <p className="section-subtitle mx-auto">
            Whether you sell high-value B2B services or source expert partners for your
            organization, PitchSignal helps you understand fit faster.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {useCases.map(({ icon: Icon, title, description, color, bg, border }) => (
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
      </div>
    </section>
  )
}
