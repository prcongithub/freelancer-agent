import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: 'Is PitchSignal an auto-bidding bot?',
    answer:
      'No. PitchSignal is built for quality-first sales workflows. It helps you qualify, research, pitch, and follow up with full human control — not automate mass outreach. There is no auto-submitting, no proposal spam, and no bid-farming. The product is designed for expert service businesses who win on fit, not volume.',
  },
  {
    question: 'Is PitchSignal only for freelancers?',
    answer:
      'No. PitchSignal is designed first for expert freelancers, independent consultants, and boutique agencies — but the product vision also includes buyer-side workflows for clearer requirements, better proposal comparison, and better-fit projects. Over time, it becomes useful for both sides of a service transaction.',
  },
  {
    question: 'Which platforms does it work with?',
    answer:
      'The product is designed to capture opportunities from freelance marketplaces, LinkedIn, email, referrals, communities, websites, and manual entries. The goal is to unify all lead sources into one clean workspace, regardless of where opportunities first appear.',
  },
  {
    question: 'Who is this for?',
    answer:
      'Expert freelancers, independent consultants, boutique agencies, and service businesses selling high-value B2B work. If you write custom proposals, manage a pipeline of client conversations, or need to understand which opportunities are worth pursuing — PitchSignal is built for you.',
  },
  {
    question: 'Can it replace my CRM?',
    answer:
      'For many small service businesses, yes. PitchSignal includes an opportunity inbox, buyer research, follow-up tracking, and revenue analytics that cover most of what a lightweight CRM provides — with context built specifically for sales at boutique service businesses. For larger teams with complex CRM workflows, it can complement existing tools.',
  },
  {
    question: 'Does it write proposals automatically?',
    answer:
      'It drafts first responses, pitch outlines, discovery questions, pricing options, and follow-up messages using your profile, case studies, and buyer context. But nothing is sent automatically — you review and control every output before it leaves your hands. The goal is better pitches, not more automated ones.',
  },
  {
    question: 'What makes it different from ChatGPT?',
    answer:
      'ChatGPT is a general-purpose writing tool. PitchSignal connects your service offers, past work, buyer signals, live opportunities, follow-up pipeline, and revenue analytics in a single workflow. Every draft is grounded in your actual history and the specific buyer context — not a blank prompt.',
  },
  {
    question: 'How does it help service buyers?',
    answer:
      "Buyer-side workflows are on the product roadmap. They're designed to help teams clarify requirements before publishing, compare vendor fit by what actually matters, and receive proposals that are calibrated to their actual situation — not generic pitches. It's a future vision, not yet available in early access.",
  },
]

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-slate-50 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-900">{question}</span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 bg-white">
          <p className="text-sm text-slate-500 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  )
}

export default function FAQ() {
  return (
    <section id="faq" className="py-20 sm:py-28 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="section-label mb-4">FAQ</span>
          <h2 className="section-title mb-5">
            Honest answers to common questions.
          </h2>
          <p className="section-subtitle mx-auto">
            If you have a question not covered here, reach out and we&apos;ll respond within one
            business day.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {faqs.map((faq) => (
            <FAQItem key={faq.question} {...faq} />
          ))}
        </div>
      </div>
    </section>
  )
}
