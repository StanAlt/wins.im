import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Client-side triggered auto-spin endpoint.
 * When a scheduled spin time arrives, any connected client can call this
 * to trigger the spin. No auth required — the endpoint validates that:
 * 1. The wheel exists and is still 'open'
 * 2. The wheel has a spin_at time that has passed
 * 3. There are at least 2 participants
 */
export async function POST(request: Request) {
  const { wheel_id } = await request.json()

  if (!wheel_id) {
    return NextResponse.json({ error: 'Missing wheel_id' }, { status: 400 })
  }

  // Use service role key to bypass RLS (falls back to anon key if service key not set)
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
  )

  // Fetch wheel
  const { data: wheel, error: wheelError } = await supabase
    .from('wheels')
    .select('*')
    .eq('id', wheel_id)
    .single()

  if (wheelError || !wheel) {
    return NextResponse.json({ error: 'Wheel not found' }, { status: 404 })
  }

  // Validate: must be open with a scheduled spin_at that has passed
  if (wheel.status !== 'open') {
    return NextResponse.json({ error: 'Wheel is not open', status: wheel.status }, { status: 400 })
  }

  if (!wheel.spin_at) {
    return NextResponse.json({ error: 'No scheduled spin time' }, { status: 400 })
  }

  const spinAt = new Date(wheel.spin_at).getTime()
  const now = Date.now()

  if (spinAt > now + 5000) { // Allow 5s tolerance
    return NextResponse.json({ error: 'Spin time not reached yet' }, { status: 400 })
  }

  // Fetch participants
  const { data: participants } = await supabase
    .from('participants')
    .select('*')
    .eq('wheel_id', wheel_id)

  if (!participants || participants.length < 2) {
    return NextResponse.json({ error: 'Need at least 2 participants' }, { status: 400 })
  }

  // Build expanded slots array
  const slots: { id: string; name: string }[] = []
  for (const p of participants) {
    for (let i = 0; i < p.slots_used; i++) {
      slots.push({ id: p.id, name: p.display_name })
    }
  }

  // Pick random winner
  const randomBytes = new Uint32Array(1)
  crypto.getRandomValues(randomBytes)
  const winnerIndex = randomBytes[0] % slots.length
  const winner = slots[winnerIndex]

  // Calculate final angle
  const sliceAngle = 360 / slots.length
  const fullRotations = 5 + Math.floor(Math.random() * 3)
  const targetSliceCenter = winnerIndex * sliceAngle + sliceAngle / 2
  const finalAngle = fullRotations * 360 + (360 - targetSliceCenter)

  // Spin duration between 4-7 seconds
  const duration = 4000 + Math.floor(Math.random() * 3000)

  // Build spin result
  const spinResult = {
    winner_name: winner.name,
    winner_id: winner.id,
    spun_at: new Date().toISOString(),
    final_angle: finalAngle,
  }

  const spinHistory = [...(wheel.spin_history || []), spinResult]

  // Single update with animation data + winner
  // Clients receive this via Postgres Realtime, animate the wheel,
  // then show the winner overlay when animation completes
  await supabase
    .from('wheels')
    .update({
      status: 'completed',
      winner_name: winner.name,
      winner_participant_id: winner.id,
      spin_history: spinHistory,
      spin_final_angle: finalAngle,
      spin_duration: duration,
      spin_winner_name: winner.name,
    })
    .eq('id', wheel_id)

  return NextResponse.json({
    final_angle: finalAngle,
    duration,
    winner_name: winner.name,
    winner_id: winner.id,
  })
}
