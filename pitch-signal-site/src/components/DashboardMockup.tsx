import {
  TrendingUp,
  Inbox,
  BarChart3,
  Settings,
  Bell,
  ChevronRight,
  Zap,
  BookOpen,
  Clock,
  AlertTriangle,
} from 'lucide-react'

function ScoreRing({ score }: { score: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="#1e293b" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="#6366f1"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold text-white leading-none">{score}</span>
        <span className="text-[9px] text-slate-400 font-medium">/100</span>
      </div>
    </div>
  )
}

export default function DashboardMockup() {
  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-700/60 bg-slate-900 select-none w-full max-w-2xl">
      {/* Titlebar */}
      <div className="flex items-center px-4 py-2.5 bg-slate-800 border-b border-slate-700">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
        </div>
        <div className="flex-1 text-center">
          <span className="text-[11px] text-slate-400 font-medium tracking-wide">
            PitchSignal — Revenue Workspace
          </span>
        </div>
        <div className="w-12" />
      </div>

      <div className="flex h-[360px] sm:h-[400px]">
        {/* Sidebar */}
        <div className="w-44 bg-slate-900 border-r border-slate-700/60 flex flex-col p-2 shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-2 px-2 py-2 mb-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-brand-600 to-violet-600 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-white" />
            </div>
            <span className="text-xs font-bold text-white">PitchSignal</span>
          </div>

          {/* Nav items */}
          {[
            { icon: Inbox, label: 'Inbox', count: 4, active: false },
            { icon: TrendingUp, label: 'Pipeline', active: true },
            { icon: BarChart3, label: 'Analytics', active: false },
            { icon: Settings, label: 'Settings', active: false },
          ].map(({ icon: Icon, label, count, active }) => (
            <div
              key={label}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                active
                  ? 'bg-brand-600/20 text-brand-300'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[11px] font-medium flex-1">{label}</span>
              {count && (
                <span className="text-[10px] bg-brand-600 text-white rounded-full px-1.5 py-0.5 leading-none">
                  {count}
                </span>
              )}
            </div>
          ))}

          {/* Divider */}
          <div className="mt-auto border-t border-slate-700/60 pt-3 px-2">
            <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2">
              Pipeline
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400">Open</span>
                <span className="text-[10px] font-semibold text-emerald-400">$142k</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400">Won (MTD)</span>
                <span className="text-[10px] font-semibold text-slate-300">$38k</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/60 bg-slate-900">
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Active Opportunity</div>
              <div className="text-xs font-semibold text-white leading-tight">
                B2B SaaS — AWS Cost Optimization
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="text-[10px] font-medium px-2.5 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 transition-colors">
                Prepare Pitch
              </button>
              <button className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
                <Bell className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Content grid */}
          <div className="flex-1 overflow-auto p-3 space-y-3">
            {/* Score + signals row */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Score card */}
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700/60">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Fit Score
                </div>
                <div className="flex items-center gap-3">
                  <ScoreRing score={86} />
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-[11px] font-bold text-emerald-400">Strong Fit</span>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-relaxed">
                      High intent
                      <br />
                      Budget fit
                      <br />
                      Low competition
                    </div>
                  </div>
                </div>
              </div>

              {/* Buyer signals */}
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700/60">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Buyer Signals
                </div>
                <div className="space-y-1.5">
                  {[
                    { label: 'Urgent infrastructure pain', color: 'text-red-400' },
                    { label: 'Cost pressure indicated', color: 'text-amber-400' },
                    { label: 'Technical buyer involved', color: 'text-blue-400' },
                    { label: 'Q1 budget window open', color: 'text-emerald-400' },
                  ].map(({ label, color }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full bg-current ${color}`} />
                      <span className="text-[10px] text-slate-300 leading-tight">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pitch angle */}
            <div className="bg-gradient-to-r from-brand-900/40 to-violet-900/30 border border-brand-700/40 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Zap className="w-3 h-3 text-brand-400" />
                <span className="text-[10px] font-semibold text-brand-300 uppercase tracking-wider">
                  Recommended Pitch Angle
                </span>
              </div>
              <p className="text-[11px] text-slate-200 leading-relaxed">
                Lead with cost reduction outcomes + production reliability. Propose a diagnostic-first engagement — paid architecture audit before full scope.
              </p>
            </div>

            {/* Proof + next action */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700/60">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <BookOpen className="w-3 h-3 text-violet-400" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Relevant Proof
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 leading-relaxed">
                  AWS Migration case study
                  <br />
                  <span className="text-emerald-400 font-semibold">32% infra cost reduction</span>
                </div>
              </div>
              <div className="bg-slate-800 rounded-xl p-3 border border-slate-700/60">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Red Flag
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 leading-relaxed">
                  Scope broad — qualify budget &amp; timeline before pricing
                </div>
              </div>
            </div>

            {/* Follow-up row */}
            <div className="flex items-center justify-between bg-slate-800 rounded-xl px-3 py-2.5 border border-slate-700/60">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-300">Next follow-up: <span className="text-amber-400 font-semibold">Tomorrow, 9:00 AM</span></span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
