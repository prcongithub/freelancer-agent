import { TrendingUp, Twitter, Linkedin, Github } from 'lucide-react'

const productLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it Works', href: '#how-it-works' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Comparison', href: '#comparison' },
]

const companyLinks = [
  { label: 'About', href: '#' },
  { label: 'Blog', href: '#' },
  { label: 'Changelog', href: '#' },
  { label: 'Contact', href: 'mailto:hello@pitchsignal.io' },
  { label: 'Privacy Policy', href: '#' },
  { label: 'Terms of Service', href: '#' },
]

const socialLinks = [
  { icon: Twitter, label: 'Twitter', href: '#' },
  { icon: Linkedin, label: 'LinkedIn', href: '#' },
  { icon: Github, label: 'GitHub', href: '#' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-slate-950 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <a href="#" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-violet-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-lg text-white">PitchSignal</span>
            </a>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              Revenue intelligence for freelancers, consultants, boutique agencies, and service buyers.
            </p>

            {/* Social */}
            <div className="flex items-center gap-2 mt-5">
              {socialLinks.map(({ icon: Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors border border-slate-700/60"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Product
            </h4>
            <ul className="space-y-2.5">
              {productLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
              Company
            </h4>
            <ul className="space-y-2.5">
              {companyLinks.map(({ label, href }) => (
                <li key={label}>
                  <a
                    href={href}
                    className="text-sm text-slate-400 hover:text-white transition-colors"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA card */}
          <div>
            <div className="rounded-xl bg-slate-800/60 border border-slate-700/60 p-5">
              <h4 className="text-sm font-semibold text-white mb-2">Join the waitlist</h4>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">
                Get early access and help shape the product roadmap.
              </p>
              <a
                href="#waitlist"
                className="inline-flex items-center justify-center w-full text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-lg transition-colors"
              >
                Get Early Access
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            &copy; {year} PitchSignal. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <a href="#" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
