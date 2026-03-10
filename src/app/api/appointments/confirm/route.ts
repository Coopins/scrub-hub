// Sends an instant booking confirmation SMS via Twilio when an appointment is created.
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase-service'
import twilio from 'twilio'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  let appointmentId: string | undefined
  let groomerId: string | undefined

  try {
    const body = await request.json()
    appointmentId = body.appointmentId
    groomerId = body.groomerId
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!appointmentId || !groomerId) {
    return NextResponse.json({ error: 'Missing appointmentId or groomerId' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Fetch appointment with client, pet, and groomer profile in parallel
  const [apptResult, profileResult] = await Promise.all([
    supabase
      .from('appointments')
      .select('scheduled_datetime, client:clients(first_name, phone, no_text_messages), pet:pets(name)')
      .eq('id', appointmentId)
      .single(),
    supabase
      .from('groomer_profiles')
      .select('business_name')
      .eq('id', groomerId)
      .single(),
  ])

  const appt = apptResult.data
  if (!appt) {
    console.error('[confirm] appointment not found:', appointmentId)
    return NextResponse.json({ skipped: true, reason: 'appointment not found' })
  }

  const client = appt.client as unknown as { first_name: string; phone: string; no_text_messages: boolean } | null
  const pet    = appt.pet    as unknown as { name: string } | null

  // Skip if client opted out
  if (!client || client.no_text_messages || !client.phone) {
    await supabase.from('notifications').insert({
      appointment_id: appointmentId,
      groomer_id:     groomerId,
      type:           'booking_confirmation',
      scheduled_for:  new Date().toISOString(),
      status:         'skipped',
      message_body:   null,
    })
    return NextResponse.json({ skipped: true, reason: 'no_text_messages or no phone' })
  }

  const apptTime     = new Date(appt.scheduled_datetime)
  const businessName = profileResult.data?.business_name ?? 'your groomer'
  const dayStr       = apptTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const timeStr      = apptTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const messageBody  = `Hi ${client.first_name}, your appointment for ${pet?.name ?? 'your pet'} is confirmed for ${dayStr} at ${timeStr} with ${businessName}. See you then!`

  let status: 'sent' | 'failed' = 'sent'

  try {
    const twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
    await twilioClient.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to:   client.phone,
    })
  } catch (err) {
    console.error('[confirm] Twilio error for appointment', appointmentId, err)
    status = 'failed'
  }

  await supabase.from('notifications').insert({
    appointment_id: appointmentId,
    groomer_id:     groomerId,
    type:           'booking_confirmation',
    scheduled_for:  new Date().toISOString(),
    sent_at:        status === 'sent' ? new Date().toISOString() : null,
    status,
    message_body:   messageBody,
  })

  return NextResponse.json({ status })
}
