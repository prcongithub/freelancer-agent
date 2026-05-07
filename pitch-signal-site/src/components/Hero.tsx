import { ArrowRight, Play, ShieldCheck } from 'lucide-react'
import DashboardMockup from './DashboardMockup'

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen bg-slate-900 flex flex-col overflow-hidden"
    >
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-gradient-radial from-brand-600/20 via-violet-700/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-brand-900/30 rounded-full blur-3xl" />
        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative flex-1 flex flex-col max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 lg:pt-32">
        {/* Announcement badge */}
        <div className="flex justify-center lg:justify-start mb-8">
          <div className="inline-flex items-center gap-2 bg-brand-600/10 border border-brand-500/20 rounded-full px-4 py-1.5 text-sm text-brand-300 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Now accepting waitlist applications
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: copy */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6">
              Turn buyer signals into{' '}
              <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
                sharper pitches
              </span>{' '}
              and better-fit projects.
            </h1>

            <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              PitchSignal helps expert freelancers and boutique agencies qualify opportunities,
              understand buyer intent, craft stronger pitches, manage follow-ups, and learn what
              actually drives revenue.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
              <a
                href="#waitlist"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-xl text-base transition-all duration-150 shadow-lg shadow-brand-600/30 hover:shadow-brand-600/40"
              >
                Join the Waitlist
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-slate-300 hover:text-white font-semibold rounded-xl text-base border border-slate-700 hover:border-slate-500 transition-all duration-150"
              >
                <Play className="w-4 h-4" />
                See How It Works
              </a>
            </div>

            <div className="flex items-center justify-center lg:justify-start gap-2 text-sm text-slate-500">
              <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Built for serious service businesses — not proposal spam.</span>
            </div>

            {/* Social proof bar */}
            <div className="mt-10 pt-8 border-t border-slate-800 grid grid-cols-3 gap-4 text-center lg:text-left">
              {[
                { value: '42%', label: 'fewer low-fit proposals' },
                { value: '2.3x', label: 'faster sales prep' },
                { value: '18%', label: 'higher reply rate' },
              ].map(({ value, label }) => (
                <div key={label}>
                  <div className="text-2xl font-bold text-white">{value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2 text-center lg:text-left">
              Illustrative early-access metrics.
            </p>
          </div>

          {/* Right: Dashboard mockup */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full lg:max-w-none relative">
              {/* Glow behind the mockup */}
              <div className="absolute -inset-4 bg-gradient-to-r from-brand-600/20 to-violet-600/20 rounded-3xl blur-2xl" />
              <div className="relative">
                <DashboardMockup />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </section>
  )
}
