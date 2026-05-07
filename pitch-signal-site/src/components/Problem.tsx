import {
  Layers,
  Filter,
  HelpCircle,
  FileText,
  BellOff,
  Archive,
  MessageSquare,
  BarChart2,
} from 'lucide-react'

const problems = [
  {
    icon: Layers,
    title: 'Leads arrive from everywhere',
    description:
      'LinkedIn, referrals, marketplaces, email, communities — opportunities are scattered across a dozen sources with no unified view.',
  },
  {
    icon: Filter,
    title: 'Hard to know what is worth pursuing',
    description:
      'Without a scoring framework, you end up spending as much time on low-fit leads as on the ones that actually close.',
  },
  {
    icon: HelpCircle,
    title: 'Buyer intent is unclear',
    description:
      'A brief from a marketplace or a cold LinkedIn message rarely tells you what the buyer actually needs or how serious they are.',
  },
  {
    icon: FileText,
    title: 'Proposals feel generic',
    description:
      "When context is missing, pitches default to boilerplate. Generic responses don't win high-value work.",
  },
  {
    icon: BellOff,
    title: 'Follow-ups are forgotten',
    description:
      'Without a system, promising conversations stall. Deals are lost to silence, not to better competitors.',
  },
  {
    icon: Archive,
    title: 'Proof and case studies are underused',
    description:
      'Most freelancers have strong past work but rarely surface the right proof at the right moment in the right pitch.',
  },
  {
    icon: MessageSquare,
    title: 'Service buyers receive irrelevant pitches',
    description:
      "Buyers waste hours reviewing proposals that don't match their requirements, making vendor evaluation painful.",
  },
  {
    icon: BarChart2,
    title: 'No visibility into what converts',
    description:
      'Without data on which channels, offers, or pitches win, every sales decision is a guess.',
  },
]

export default function Problem() {
  return (
    <section id="problem" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <span className="section-label mb-4">The Problem</span>
          <h2 className="section-title mb-5">
            Freelancers and agencies don&apos;t lose deals only because of bad pitches. They lose
            because they lack signal.
          </h2>
          <p className="section-subtitle mx-auto">
            The real challenge is not writing quality — it is having the context, clarity, and
            systems to act on the right opportunities at the right time.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {problems.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="p-5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-md transition-all duration-200 group"
            >
              <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center mb-3 group-hover:bg-red-100 transition-colors">
                <Icon className="w-4.5 h-4.5 text-red-500" size={18} />
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
