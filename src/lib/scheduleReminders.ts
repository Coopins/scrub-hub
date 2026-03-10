import { createClient } from '@/lib/supabase'

export interface ReminderPreferences {
  reminder_1week: boolean
  reminder_24h: boolean
  reminder_2h: boolean
}

export const DEFAULT_PREFERENCES: ReminderPreferences = {
  reminder_1week: false,
  reminder_24h: true,
  reminder_2h: true,
}

const REMINDER_WINDOWS = [
  { key: 'reminder_1week' as const, offsetMs: 7 * 24 * 60 * 60 * 1000 },
  { key: 'reminder_24h'  as const, offsetMs: 24 * 60 * 60 * 1000 },
  { key: 'reminder_2h'   as const, offsetMs: 2  * 60 * 60 * 1000 },
]

/**
 * After an appointment is created or updated, call this to:
 *  1. Delete any existing pending notifications for the appointment
 *  2. Re-generate notifications based on the groomer's current preferences
 *
 * Safe to call from client-side — uses the browser Supabase client.
 * Silently skips clients who have no_text_messages set.
 */
export async function scheduleReminders(
  appointmentId: string,
  groomerId: string
): Promise<void> {
  const supabase = createClient()

  // Fetch appointment with client + pet info needed for the SMS body
  const { data: appt } = await supabase
    .from('appointments')
    .select('scheduled_datetime, client:clients(first_name, phone, no_text_messages), pet:pets(name)')
    .eq('id', appointmentId)
    .single()

  if (!appt) return

  const client = appt.client as { first_name: string; phone: string; no_text_messages: boolean } | null
  const pet    = appt.pet    as { name: string } | null

  // Delete existing pending notifications (handles rescheduling on edit)
  await supabase
    .from('notifications')
    .delete()
    .eq('appointment_id', appointmentId)
    .eq('status', 'pending')

  // Skip if client has opted out of texts
  if (!client || client.no_text_messages) return

  // Fetch groomer preferences + business name
  const { data: profile } = await supabase
    .from('groomer_profiles')
    .select('reminder_preferences, business_name')
    .eq('id', groomerId)
    .single()

  const prefs: ReminderPreferences = {
    ...DEFAULT_PREFERENCES,
    ...(profile?.reminder_preferences ?? {}),
  }

  const businessName = profile?.business_name ?? 'your groomer'
  const apptTime     = new Date(appt.scheduled_datetime)
  const now          = new Date()

  // Build SMS body (same for all reminders on this appointment)
  const dayStr  = apptTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeStr = apptTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const messageBody = `Hi ${client.first_name}, just a reminder that ${pet?.name ?? 'your pet'} has a grooming appointment on ${dayStr} at ${timeStr} with ${businessName}. Reply STOP to opt out.`

  const rows = REMINDER_WINDOWS
    .filter(w => prefs[w.key])
    .map(w => {
      const scheduledFor = new Date(apptTime.getTime() - w.offsetMs)
      return {
        appointment_id: appointmentId,
        groomer_id:     groomerId,
        type:           'sms_reminder',
        scheduled_for:  scheduledFor.toISOString(),
        status:         scheduledFor <= now ? 'skipped' : 'pending',
        message_body:   messageBody,
      }
    })

  if (rows.length > 0) {
    await supabase.from('notifications').insert(rows)
  }
}
