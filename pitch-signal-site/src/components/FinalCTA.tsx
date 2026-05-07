import { ArrowRight, Mail } from 'lucide-react'

export default function FinalCTA() {
  return (
    <section
      id="waitlist"
      className="py-20 sm:py-32 bg-slate-900 relative overflow-hidden"
    >
      {/* Background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-600/15 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-violet-600/10 rounded-full blur-3xl" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-brand-600/10 border border-brand-500/20 rounded-full px-4 py-1.5 text-sm text-brand-300 font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Early access open now
        </div>

        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
          Build your sales system around{' '}
          <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
            signal
          </span>
          , not guesswork.
        </h2>

        <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl mx-auto">
          Stop chasing every lead. Start understanding which opportunities deserve your time — and
          exactly how to win them.
        </p>

        {/* Email form */}
        <div className="max-w-md mx-auto mb-6">
          <div className="flex gap-2 p-1.5 bg-slate-800 border border-slate-700 rounded-xl focus-within:border-brand-500 transition-colors">
            <div className="flex-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                placeholder="you@company.com"
                className="w-full bg-transparent pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />
            </div>
            <button className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm rounded-lg transition-colors shadow-lg shadow-brand-600/30">
              Join Waitlist
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <a
            href="mailto:hello@pitchsignal.io"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 px-5 py-2.5 rounded-xl transition-colors"
          >
            Request Early Access
          </a>
        </div>

        <p className="text-xs text-slate-600 mt-8">
          No commitment required. We&apos;ll reach out with access details and onboarding support.
        </p>

        {/* Trust row */}
        <div className="mt-12 pt-8 border-t border-slate-800 grid grid-cols-3 gap-8 max-w-2xl mx-auto">
          {[
            { value: '42%', label: 'fewer low-fit proposals' },
            { value: '2.3x', label: 'faster sales prep' },
            { value: '18%', label: 'higher reply rate' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-700 mt-2">Illustrative early-access metrics.</p>
      </div>
    </section>
  )
}
