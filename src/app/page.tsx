import Link from 'next/link'
import { Scissors } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-600 p-4 rounded-2xl shadow-lg">
            <Scissors className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Wordmark */}
        <h1 className="text-4xl font-bold text-white tracking-tight mb-3">Scrub Hub</h1>

        {/* Tagline */}
        <p className="text-slate-400 text-lg leading-relaxed mb-10">
          Professional Grooming Software —{' '}
          <span className="text-slate-300">Built by Groomers, for Groomers</span>
        </p>

        {/* CTA */}
        <Link
          href="/login"
          className="inline-flex items-center justify-center px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold text-base transition-colors"
        >
          Sign In
        </Link>
      </div>

      {/* Footer */}
      <p className="absolute bottom-6 text-slate-600 text-xs flex items-center gap-2">
        <span>© {new Date().getFullYear()} Scrub Hub</span>
        <span>·</span>
        <Link href="/terms" className="hover:text-slate-400 transition-colors">
          Terms
        </Link>
        <span>·</span>
        <Link href="/privacy" className="hover:text-slate-400 transition-colors">
          Privacy
        </Link>
        <span>·</span>
        <a href="mailto:chris@nullstate.co" className="hover:text-slate-400 transition-colors">
          chris@nullstate.co
        </a>
      </p>
    </div>
  )
}
