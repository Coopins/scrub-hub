import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-service'
import twilio from 'twilio'

export const runtime = 'nodejs'

export async function POST() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabase
    .from('groomer_profiles')
    .select('phone')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.phone) {
    return NextResponse.json(
      { error: 'No phone number on your profile. Add one in Settings first.' },
      { status: 400 }
    )
  }

  const serviceClient = createServiceClient()
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  )

  const message = 'Scrub Hub test message - SMS is working correctly!'

  try {
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: profile.phone,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Twilio error'
    console.error('[sms/test] Twilio error:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  await serviceClient.from('notifications').insert({
    groomer_id: user.id,
    appointment_id: null,
    type: 'test',
    scheduled_for: new Date().toISOString(),
    sent_at: new Date().toISOString(),
    status: 'sent',
    message_body: message,
  })

  return NextResponse.json({ success: true })
}
