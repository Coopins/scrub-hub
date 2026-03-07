import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import twilio from 'twilio'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  // Verify Vercel cron secret (set CRON_SECRET in Vercel env vars)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()

  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  )

  // Fetch all pending notifications that are due
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select(`
      id,
      message_body,
      appointment_id,
      appointment:appointments (
        client:clients ( phone, no_text_messages )
      )
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())

  if (error) {
    console.error('[send-reminders] fetch error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  let sent = 0
  let failed = 0
  let skipped = 0

  for (const notification of notifications ?? []) {
    const appt   = notification.appointment as any
    const client = appt?.client as { phone: string; no_text_messages: boolean } | null

    // Skip if client opted out (shouldn't happen — scheduleReminders guards this —
    // but double-check here as a safety net)
    if (!client || client.no_text_messages || !client.phone) {
      await supabase
        .from('notifications')
        .update({ status: 'skipped' })
        .eq('id', notification.id)
      skipped++
      continue
    }

    try {
      await twilioClient.messages.create({
        body: notification.message_body ?? '',
        from: process.env.TWILIO_PHONE_NUMBER!,
        to:   client.phone,
      })

      await supabase
        .from('notifications')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', notification.id)

      sent++
    } catch (err) {
      console.error('[send-reminders] Twilio error for notification', notification.id, err)
      await supabase
        .from('notifications')
        .update({ status: 'failed' })
        .eq('id', notification.id)
      failed++
    }
  }

  console.log(`[send-reminders] sent=${sent} failed=${failed} skipped=${skipped}`)
  return NextResponse.json({
    sent,
    failed,
    skipped,
    total: (notifications ?? []).length,
  })
}
