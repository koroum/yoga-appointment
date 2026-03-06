import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? ''
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? ''
const TWILIO_FROM = Deno.env.get('TWILIO_PHONE_FROM') ?? ''
const APP_EMAIL_FROM = Deno.env.get('APP_EMAIL_FROM') ?? 'no-reply@yogabookings.app'

type NotificationType =
  | 'booking_requested'
  | 'booking_confirmed'
  | 'booking_rejected'
  | 'booking_cancelled'
  | 'cancellation_requested'

function buildMessage(type: NotificationType, ctx: {
  studentName: string
  instructorName: string
  classTitle: string
  dateStr: string
}): { subject: string; body: string; sms: string } {
  const { studentName, instructorName, classTitle, dateStr } = ctx
  switch (type) {
    case 'booking_requested':
      return {
        subject: `New booking request — ${classTitle}`,
        body: `Hi ${instructorName},\n\n${studentName} has requested a spot in "${classTitle}" on ${dateStr}.\n\nPlease log in to confirm or decline.`,
        sms: `${studentName} requested "${classTitle}" on ${dateStr}. Log in to confirm.`,
      }
    case 'booking_confirmed':
      return {
        subject: `Booking confirmed — ${classTitle}`,
        body: `Hi ${studentName},\n\nYour booking for "${classTitle}" on ${dateStr} with ${instructorName} has been confirmed!`,
        sms: `Your "${classTitle}" on ${dateStr} is confirmed!`,
      }
    case 'booking_rejected':
      return {
        subject: `Booking declined — ${classTitle}`,
        body: `Hi ${studentName},\n\nYour request for "${classTitle}" on ${dateStr} was declined by ${instructorName}.`,
        sms: `Your request for "${classTitle}" on ${dateStr} was declined.`,
      }
    case 'booking_cancelled':
      return {
        subject: `Booking cancelled — ${classTitle}`,
        body: `Hi ${studentName},\n\nYour booking for "${classTitle}" on ${dateStr} has been cancelled.`,
        sms: `Your booking for "${classTitle}" on ${dateStr} was cancelled.`,
      }
    case 'cancellation_requested':
      return {
        subject: `Cancellation request — ${classTitle}`,
        body: `Hi ${instructorName},\n\n${studentName} has requested to cancel their booking for "${classTitle}" on ${dateStr}.\n\nPlease log in to approve.`,
        sms: `${studentName} wants to cancel "${classTitle}" on ${dateStr}.`,
      }
  }
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  if (!RESEND_API_KEY) return false
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: APP_EMAIL_FROM, to, subject, text: body }),
    })
    return res.ok
  } catch {
    return false
  }
}

async function sendSms(to: string, body: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) return false
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
        },
        body: new URLSearchParams({ From: TWILIO_FROM, To: to, Body: body }).toString(),
      },
    )
    return res.ok
  } catch {
    return false
  }
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}))
    const { booking_id, type } = body as { booking_id?: string; type?: string }

    if (!booking_id) return new Response(JSON.stringify({ ok: false, error: 'booking_id required' }), { status: 400 })
    if (!type) return new Response(JSON.stringify({ ok: false, error: 'type required' }), { status: 400 })

    const supabase = createClient(supabaseUrl, serviceKey)

    // Dedup: skip if same type already sent today for this booking
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { data: existing } = await supabase
      .from('notifications_log')
      .select('id')
      .eq('booking_id', booking_id)
      .eq('type', type)
      .gte('sent_at', todayStart.toISOString())
      .maybeSingle()

    if (existing) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: 'already_sent_today' }))
    }

    // Fetch booking details
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        student:users!bookings_student_id_fkey(id, name, email, phone),
        slot:slots(
          starts_at,
          instructor_id,
          class:classes(title),
          instructor:users!slots_instructor_id_fkey(id, name, email, phone)
        )
      `)
      .eq('id', booking_id)
      .single()

    if (bookingErr || !booking) {
      return new Response(JSON.stringify({ ok: false, error: 'booking not found' }), { status: 404 })
    }

    const student = booking.student as { id: string; name: string; email: string | null; phone: string | null }
    const slot = booking.slot as { starts_at: string; instructor_id: string; class: { title: string }; instructor: { id: string; name: string; email: string | null; phone: string | null } }
    const instructor = slot.instructor
    const dateStr = new Date(slot.starts_at).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York',
    })

    const notifType = type as NotificationType
    const msg = buildMessage(notifType, {
      studentName: student.name,
      instructorName: instructor.name,
      classTitle: slot.class.title,
      dateStr,
    })

    // Determine recipient (instructor gets notified of requests/cancels, student gets confirmations/rejections/cancels)
    const isInstructorTarget = type === 'booking_requested' || type === 'cancellation_requested'
    const recipient = isInstructorTarget ? instructor : student

    let emailOk = false
    let smsOk = false

    if (recipient.email) {
      emailOk = await sendEmail(recipient.email, msg.subject, msg.body)
    }
    if (recipient.phone) {
      smsOk = await sendSms(recipient.phone, msg.sms)
    }

    // Log the notification
    const channel = recipient.email ? 'email' : 'sms'
    const sent = emailOk || smsOk
    await supabase.from('notifications_log').insert({
      booking_id,
      recipient_id: recipient.id,
      channel,
      type,
      status: sent ? 'sent' : 'failed',
      sent_at: sent ? new Date().toISOString() : null,
    })

    return new Response(JSON.stringify({ ok: true, sent, emailOk, smsOk }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500 })
  }
})
