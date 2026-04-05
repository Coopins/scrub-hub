import Link from 'next/link'
import { Scissors } from 'lucide-react'

export default function TermsPage() {
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
          <p className="text-slate-400 mt-1 text-sm">Terms of Service</p>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 divide-y divide-slate-700">
          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Acceptance of Terms</h2>
            <p className="text-slate-300 leading-relaxed">
              By accessing or using Scrub Hub, you agree to be bound by these Terms of Service. If
              you do not agree to these terms, please do not use the service. We may update these
              terms from time to time — continued use of the service after changes constitutes
              acceptance of the updated terms.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Description of Service</h2>
            <p className="text-slate-300 leading-relaxed">
              Scrub Hub is a grooming salon management platform that helps professional groomers
              manage clients, appointments, scheduling, and automated SMS reminders. The service is
              intended for use by grooming businesses and their authorized staff.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">User Accounts</h2>
            <p className="text-slate-300 leading-relaxed">
              You are responsible for maintaining the security of your account credentials. Do not
              share your password with others. You are responsible for all activity that occurs under
              your account. Notify us immediately at{' '}
              <a
                href="mailto:support@scrubhub.com"
                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
              >
                support@scrubhub.com
              </a>{' '}
              if you believe your account has been compromised.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Acceptable Use</h2>
            <p className="text-slate-300 leading-relaxed">
              You agree to use Scrub Hub only for lawful purposes and in connection with operating a
              legitimate grooming business. You may not use the service to send unsolicited messages,
              harass clients, or violate any applicable laws or regulations including those governing
              SMS communications.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Payment Terms</h2>
            <p className="text-slate-300 leading-relaxed">
              Paid plans are billed on a monthly basis. Fees are non-refundable except where required
              by law. We reserve the right to change pricing with reasonable notice. Failure to pay
              may result in suspension or termination of your account.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Termination</h2>
            <p className="text-slate-300 leading-relaxed">
              You may cancel your account at any time. We reserve the right to suspend or terminate
              accounts that violate these terms, engage in fraudulent activity, or create risk for
              Scrub Hub or other users. Upon termination, your access to the service will end.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Limitation of Liability</h2>
            <p className="text-slate-300 leading-relaxed">
              Scrub Hub is provided "as is" without warranties of any kind. We are not liable for any
              indirect, incidental, or consequential damages arising from your use of the service,
              including but not limited to lost revenue, missed appointments, or SMS delivery
              failures. Our total liability to you shall not exceed the amount you paid us in the
              twelve months preceding the claim.
            </p>
          </div>

          <div className="p-8">
            <h2 className="text-xl font-semibold text-white mb-3">Contact Information</h2>
            <p className="text-slate-300 leading-relaxed">
              Questions about these Terms of Service? Reach us at{' '}
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
          <Link href="/privacy" className="hover:text-slate-400 transition-colors">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
