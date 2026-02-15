import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { wheel_id } = await request.json()

  // Verify user is the admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch wheel
  const { data: wheel, error: wheelError } = await supabase
    .from('wheels')
    .select('*')
    .eq('id', wheel_id)
    .single()

  if (wheelError || !wheel) {
    return NextResponse.json({ error: 'Wheel not found' }, { status: 404 })
  }

  if (wheel.admin_id !== user.id) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
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

  // Pick random winner using crypto
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

  // Single update: set status to 'spinning' with all animation + winner data
  // The client will animate the wheel, then show the winner when animation completes.
  // Status goes straight to 'completed' but with spin_final_angle set,
  // so the client knows to animate first before revealing the winner.
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
