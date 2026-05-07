import {
  Inbox,
  Target,
  FileSearch,
  BookMarked,
  PenLine,
  BarChart3,
} from 'lucide-react'

const features = [
  {
    icon: Inbox,
    title: 'Opportunity Inbox',
    description:
      'Bring leads from marketplaces, LinkedIn, email, referrals, communities, and manual entries into one clean workspace. No more context-switching across tabs and tools.',
    tag: 'Capture',
    color: 'text-brand-600',
    bg: 'bg-brand-50',
    border: 'border-brand-100',
  },
  {
    icon: Target,
    title: 'Buyer Signal Scoring',
    description:
      'Understand whether an opportunity is worth pursuing based on buyer intent, urgency, budget fit, service match, deal size potential, and red flags — before spending time on a pitch.',
    tag: 'Qualify',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-100',
  },
  {
    icon: FileSearch,
    title: 'Buyer Intelligence Briefs',
    description:
      'Generate context-rich buyer briefs with company background, likely pains, personalization hooks, decision context, and sales conversation preparation so you walk in informed.',
    tag: 'Research',
    color: 'text-sky-600',
    bg: 'bg-sky-50',
    border: 'border-sky-100',
  },
  {
    icon: BookMarked,
    title: 'Proof & Case Study Matching',
    description:
      'Match each opportunity with the most relevant portfolio items, testimonials, past projects, and outcome metrics. Surface the right proof at the right moment in every pitch.',
    tag: 'Differentiate',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
  },
  {
    icon: PenLine,
    title: 'Pitch & Proposal Copilot',
    description:
      'Draft first responses, discovery questions, proposal outlines, pricing options, objection handling, and follow-up messages — all grounded in your actual past work and profile.',
    tag: 'Convert',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
  },
  {
    icon: BarChart3,
    title: 'Revenue Analytics',
    description:
      'Understand reply rates, close rates, revenue by channel, best-performing offers, common lost reasons, and where your sales time is actually being spent.',
    tag: 'Learn',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
    border: 'border-rose-100',
  },
]

export default function Features() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="section-label mb-4">Core Features</span>
          <h2 className="section-title mb-5">
            Everything you need to win better work, consistently.
          </h2>
          <p className="section-subtitle mx-auto">
            Six integrated modules that work together as a complete sales intelligence system —
            not a pile of disconnected tools.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon: Icon, title, description, tag, color, bg, border }) => (
            <div
              key={title}
              className="relative p-6 rounded-2xl border border-slate-200 bg-white hover:shadow-lg hover:border-slate-300 transition-all duration-200 group"
            >
              {/* Tag */}
              <div className="absolute top-5 right-5">
                <span
                  className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${bg} ${color} border ${border}`}
                >
                  {tag}
                </span>
              </div>

              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-xl ${bg} border ${border} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}
              >
                <Icon className={`w-5 h-5 ${color}`} />
              </div>

              <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
