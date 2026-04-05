export default function SmsConsentPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center py-16 px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-white tracking-tight">Scrub Hub</h1>
          <p className="text-slate-400 mt-1 text-sm">Grooming Salon Management</p>
        </div>

        <div className="bg-slate-800 rounded-xl p-8 space-y-8 border border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">SMS Appointment Reminders</h2>
            <p className="text-slate-300 leading-relaxed">
              By providing your phone number when booking an appointment with a Scrub Hub grooming
              business, you agree to receive appointment reminders and booking confirmations via SMS.
              Message frequency varies. Message and data rates may apply.
            </p>
          </div>

          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-white mb-2">How to Opt Out</h3>
            <p className="text-slate-300 leading-relaxed">
              Reply <span className="font-mono font-semibold text-white">STOP</span> to any message
              to unsubscribe. Reply{' '}
              <span className="font-mono font-semibold text-white">HELP</span> for assistance.
            </p>
          </div>

          <div className="border-t border-slate-700 pt-6">
            <p className="text-slate-400 text-sm">
              For support, contact us at{' '}
              <a
                href="mailto:support@scrubhub.com"
                className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
              >
                support@scrubhub.com
              </a>
            </p>
          </div>

          <div className="border-t border-slate-700 pt-6">
            <p className="text-slate-500 text-xs text-center">
              <a
                href="/privacy"
                className="text-slate-400 hover:text-slate-300 underline underline-offset-2 transition-colors"
              >
                Privacy Policy
              </a>
              {' '}·{' '}
              <a
                href="/terms"
                className="text-slate-400 hover:text-slate-300 underline underline-offset-2 transition-colors"
              >
                Terms of Service
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
