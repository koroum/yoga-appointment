import { createClient } from 'npm:@supabase/supabase-js@2'
import { addMonths, addMinutes, startOfDay, eachDayOfInterval, getDay, format, parseISO, isBefore } from 'npm:date-fns@3'
import { toZonedTime, fromZonedTime } from 'npm:date-fns-tz@3'

const NY_TZ = 'America/New_York'

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json().catch(() => ({}))
    const instructorIdFilter: string | null = body?.instructor_id ?? null

    // Load active availability rules
    let query = supabase
      .from('availability_rules')
      .select('*, class:classes(id, duration_minutes, max_capacity)')
      .eq('is_active', true)

    if (instructorIdFilter) {
      query = query.eq('instructor_id', instructorIdFilter)
    }

    const { data: rules, error: rulesErr } = await query
    if (rulesErr) throw rulesErr

    const now = new Date()
    const windowEnd = addMonths(now, 2)
    let generated = 0
    let skipped = 0

    for (const rule of rules ?? []) {
      // Find all dates in the 2-month window that match the day_of_week
      const allDays = eachDayOfInterval({ start: startOfDay(now), end: windowEnd })
      const matchingDays = allDays.filter(d => getDay(d) === rule.day_of_week)

      for (const day of matchingDays) {
        // Build the slot start time in NY timezone then convert to UTC
        const [hours, minutes] = rule.start_time.split(':').map(Number)
        const nyDay = toZonedTime(day, NY_TZ)
        nyDay.setHours(hours, minutes, 0, 0)
        const startsUtc = fromZonedTime(nyDay, NY_TZ)
        const endsUtc = addMinutes(startsUtc, rule.class.duration_minutes)

        if (isBefore(startsUtc, now)) continue

        const startsStr = startsUtc.toISOString()

        // Check if a slot already exists for this instructor + time
        const { data: existing } = await supabase
          .from('slots')
          .select('id, status')
          .eq('instructor_id', rule.instructor_id)
          .eq('starts_at', startsStr)
          .maybeSingle()

        if (existing) {
          // Skip if already exists (idempotent); don't overwrite unavailable
          skipped++
          continue
        }

        // Insert new available slot
        const { error: insertErr } = await supabase.from('slots').insert({
          class_id: rule.class_id,
          instructor_id: rule.instructor_id,
          starts_at: startsStr,
          ends_at: endsUtc.toISOString(),
          status: 'available',
        })

        if (insertErr) {
          console.error(`Failed to insert slot for ${rule.instructor_id} at ${startsStr}:`, insertErr.message)
        } else {
          generated++
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, generated, skipped }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
