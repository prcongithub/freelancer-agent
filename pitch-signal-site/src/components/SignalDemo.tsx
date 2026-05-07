import {
  Zap,
  AlertTriangle,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Target,
  TrendingUp,
} from 'lucide-react'

function ScoreBadge({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-emerald-500 rounded-full transition-all duration-700"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-emerald-400 font-bold text-sm">{score}/100</span>
    </div>
  )
}

export default function SignalDemo() {
  return (
    <section id="signal-demo" className="py-20 sm:py-28 bg-slate-900 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-brand-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-widest uppercase text-brand-400 bg-brand-600/10 border border-brand-500/20 rounded-full px-3 py-1 mb-4">
            <Zap className="w-3 h-3" />
            What is the Signal?
          </span>
          <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight tracking-tight mb-5">
            See exactly what PitchSignal reveals about every opportunity.
          </h2>
          <p className="text-lg text-slate-400 leading-relaxed">
            In seconds, get a complete picture of buyer intent, fit, risk, and the exact pitch
            angle most likely to win — grounded in your past work.
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/80 backdrop-blur overflow-hidden shadow-2xl shadow-black/40">
            {/* Card header */}
            <div className="px-5 py-4 border-b border-slate-700/60 bg-slate-900/60">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">
                    Incoming Opportunity
                  </div>
                  <h3 className="text-base font-semibold text-white">
                    B2B SaaS company looking for AWS cost optimization and infrastructure reliability review.
                  </h3>
                </div>
                <div className="shrink-0 text-xs font-semibold text-slate-400 bg-slate-700 rounded-lg px-2.5 py-1.5 border border-slate-600">
                  Marketplace
                </div>
              </div>
            </div>

            {/* Analysis grid */}
            <div className="p-5 grid md:grid-cols-2 gap-4">
              {/* Fit Score */}
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/40">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-brand-400" />
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Fit Score — Strong Fit
                  </span>
                </div>
                <ScoreBadge score={86} />
                <p className="text-xs text-slate-400 mt-2">
                  High urgency, clear budget signal, technical buyer involved, service alignment strong.
                </p>
              </div>

              {/* Buyer Signals */}
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/40">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Detected Buyer Signals
                  </span>
                </div>
                <div className="space-y-2">
                  {[
                    { text: 'Urgent infrastructure reliability concern', color: 'text-red-400' },
                    { text: 'Cost optimization language — measurable business pain', color: 'text-amber-400' },
                    { text: 'Technical buyer likely involved in decision', color: 'text-sky-400' },
                    { text: 'Broad scope requires qualification before pricing', color: 'text-violet-400' },
                  ].map(({ text, color }) => (
                    <div key={text} className="flex items-start gap-2">
                      <div className={`w-1.5 h-1.5 rounded-full bg-current mt-1.5 shrink-0 ${color}`} />
                      <span className="text-xs text-slate-300 leading-relaxed">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pitch Angle */}
              <div className="bg-gradient-to-br from-brand-900/50 to-violet-900/30 rounded-xl p-4 border border-brand-700/30">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-brand-400" />
                  <span className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
                    Recommended Pitch Angle
                  </span>
                </div>
                <p className="text-sm text-white font-medium leading-relaxed mb-2">
                  "Lead with cost reduction, production reliability, and a diagnostic-first engagement."
                </p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Frame the engagement as a low-risk architecture audit before proposing full scope.
                  Position outcomes in dollars saved and incidents avoided.
                </p>
              </div>

              {/* Proof Match */}
              <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/40">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Relevant Proof
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 bg-emerald-900/20 border border-emerald-700/30 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-white">AWS Migration case study</div>
                      <div className="text-xs text-emerald-400 mt-0.5">32% infrastructure cost reduction</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <div className="text-xs font-medium text-slate-300">SRE engagement — zero-downtime migration</div>
                      <div className="text-xs text-slate-500 mt-0.5">Moderate match</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Red Flags */}
              <div className="bg-slate-900/60 rounded-xl p-4 border border-amber-700/20">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                    Red Flags
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Scope is broad. Before pricing, ask about monthly AWS bill, current architecture,
                  downtime history, and internal ownership structure.
                </p>
              </div>

              {/* Next Action */}
              <div className="bg-slate-900/60 rounded-xl p-4 border border-brand-700/20">
                <div className="flex items-center gap-2 mb-3">
                  <ArrowRight className="w-4 h-4 text-brand-400" />
                  <span className="text-xs font-semibold text-brand-300 uppercase tracking-wider">
                    Suggested Next Action
                  </span>
                </div>
                <p className="text-sm text-white font-medium leading-relaxed mb-3">
                  Send a diagnostic-first response and propose a paid architecture audit.
                </p>
                <button className="w-full text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg py-2 px-3 transition-colors">
                  Draft First Response
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 mt-4">
            Sample analysis. Actual output is grounded in your profile, past work, and buyer context.
          </p>
        </div>
      </div>
    </section>
  )
}
