import Link from 'next/link'
import { Scissors } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex justify-center mb-4">
            <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg">
              <Scissors className="w-7 h-7 text-white" />
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-white tracking-tight">Scrub Hub</h1>
          <p className="text-slate-400 mt-1 text-sm">Privacy Policy</p>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Information We Collect</h2>
            <p className="text-slate-300 leading-relaxed mb-3">
              We collect information you provide directly when using Scrub Hub:
            </p>
            <ul className="text-slate-300 space-y-1 list-disc list-inside leading-relaxed">
              <li>Name and email address (account registration)</li>
              <li>Phone number (for SMS reminders)</li>
              <li>Business information (salon name, contact details)</li>
              <li>Client and pet data you enter into the system</li>
              <li>Appointment history and notes</li>
            </ul>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">How We Use Your Information</h2>
            <p className="text-slate-300 leading-relaxed">
              We use the information we collect to provide and improve the Scrub Hub service —
              including displaying your client and appointment data, sending automated SMS appointment
              reminders on your behalf, and contacting you about your account. We do not sell your
              data or your clients' data to third parties.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">SMS Messaging</h2>
            <p className="text-slate-300 leading-relaxed">
              Clients opt in to SMS appointment reminders by providing their phone number when
              booking an appointment with a Scrub Hub grooming business. Message frequency varies
              based on appointment activity. Message and data rates may apply. To opt out, reply{' '}
              <span className="font-mono font-semibold text-white">STOP</span> to any message. Reply{' '}
              <span className="font-mono font-semibold text-white">HELP</span> for assistance.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Data Storage</h2>
            <p className="text-slate-300 leading-relaxed">
              Your data is stored securely using{' '}
              <span className="text-slate-200 font-medium">Supabase</span>, a hosted database
              platform. All data is encrypted in transit and at rest. Access is controlled through
              row-level security policies so that each groomer account can only access their own
              data.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Third Party Services</h2>
            <p className="text-slate-300 leading-relaxed">
              Scrub Hub uses <span className="text-slate-200 font-medium">Twilio</span> to deliver
              SMS appointment reminders. When an SMS is sent, your client's phone number and the
              message content are transmitted to Twilio for delivery. Twilio's use of this data is
              governed by their own privacy policy. We do not share data with any other third-party
              services for marketing or advertising purposes.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Data Retention</h2>
            <p className="text-slate-300 leading-relaxed">
              We retain your account data for as long as your account is active. If you close your
              account, we will delete your data within a reasonable period unless we are required to
              retain it for legal or compliance reasons. You may request deletion of your data at any
              time by contacting us.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Contact Information</h2>
            <p className="text-slate-300 leading-relaxed">
              Questions about this Privacy Policy? Reach us at{' '}
              <a
                href="mailto:support@scrubhub.com"
                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
              >
                support@scrubhub.com
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-10">
          © {new Date().getFullYear()} Scrub Hub &nbsp;·&nbsp;{' '}
          <Link href="/terms" className="hover:text-slate-400 transition-colors">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  )
}
