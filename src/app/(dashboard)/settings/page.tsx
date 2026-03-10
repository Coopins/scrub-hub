'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { type ReminderPreferences, DEFAULT_PREFERENCES } from '@/lib/scheduleReminders'

const REMINDER_OPTIONS: { key: keyof ReminderPreferences; label: string; description: string }[] = [
  {
    key: 'reminder_1week',
    label: '1 Week Before',
    description: 'Sent 7 days ahead — great for clients who need to arrange drop-off',
  },
  {
    key: 'reminder_24h',
    label: '24 Hours Before',
    description: 'Sent the day before — the most common reminder window',
  },
  {
    key: 'reminder_2h',
    label: '2 Hours Before',
    description: 'Sent 2 hours ahead — a same-day nudge for clients',
  },
]

function Toggle({ on, disabled }: { on: boolean; disabled: boolean }) {
  return (
    <div
      className={`relative flex-shrink-0 w-12 h-7 rounded-full transition-colors duration-200 ${
        on ? 'bg-emerald-600' : 'bg-slate-600'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <div
        className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
          on ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </div>
  )
}

export default function SettingsPage() {
  const supabase = createClient()
  const [prefs, setPrefs] = useState<ReminderPreferences>(DEFAULT_PREFERENCES)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('groomer_profiles')
        .select('reminder_preferences')
        .eq('id', user.id)
        .single()
      if (data?.reminder_preferences) {
        setPrefs({ ...DEFAULT_PREFERENCES, ...data.reminder_preferences })
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleToggle(key: keyof ReminderPreferences) {
    if (saving) return
    const prev = prefs
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPrefs(prev); setSaving(false); return }

    const { error } = await supabase
      .from('groomer_profiles')
      .update({ reminder_preferences: next })
      .eq('id', user.id)

    if (error) {
      toast.error('Failed to save — please try again')
      setPrefs(prev)
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400">Configure your grooming salon preferences</p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <CardTitle className="text-white">SMS Reminders</CardTitle>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Automatic text reminders sent to clients before each appointment.
            Clients with <span className="text-slate-300 font-medium">No Text Messages</span> enabled will never receive reminders regardless of these settings.
          </p>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Booking confirmation — always on, not toggleable */}
          <div className="w-full flex items-center justify-between gap-4 p-4 rounded-lg bg-slate-800 border border-slate-700 min-h-[64px]">
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm leading-snug">Booking Confirmation</p>
              <p className="text-slate-400 text-xs mt-0.5 leading-snug">Sent instantly when an appointment is scheduled</p>
            </div>
            <div className="relative flex-shrink-0 w-12 h-7 rounded-full bg-emerald-600">
              <div className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm translate-x-6" />
            </div>
          </div>

          {loading ? (
            <div className="py-6 text-center text-slate-500 text-sm">Loading preferences…</div>
          ) : (
            <>
              {REMINDER_OPTIONS.map(option => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleToggle(option.key)}
                  disabled={saving}
                  className="w-full flex items-center justify-between gap-4 p-4 rounded-lg bg-slate-800 border border-slate-700 hover:border-slate-600 active:border-slate-500 transition-colors text-left touch-manipulation min-h-[64px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm leading-snug">{option.label}</p>
                    <p className="text-slate-400 text-xs mt-0.5 leading-snug">{option.description}</p>
                  </div>
                  <Toggle on={prefs[option.key]} disabled={saving} />
                </button>
              ))}

              <p className="text-slate-500 text-xs pt-1 leading-relaxed">
                Changes save instantly. These settings apply to new appointments only — existing scheduled reminders are not affected.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
