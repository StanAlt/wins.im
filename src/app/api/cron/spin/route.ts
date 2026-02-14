import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role key to bypass RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Find wheels with scheduled spin time that has passed and status is still 'open'
  const now = new Date().toISOString()
  const { data: dueWheels, error: queryError } = await supabase
    .from('wheels')
    .select('*')
    .eq('status', 'open')
    .not('spin_at', 'is', null)
    .lte('spin_at', now)

  if (queryError) {
    console.error('Cron: error querying due wheels:', queryError)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  if (!dueWheels || dueWheels.length === 0) {
    return NextResponse.json({ message: 'No wheels due for spin', spun: 0 })
  }

  const results = []

  for (const wheel of dueWheels) {
    try {
      // Fetch participants
      const { data: participants } = await supabase
        .from('participants')
        .select('*')
        .eq('wheel_id', wheel.id)

      if (!participants || participants.length < 2) {
        results.push({ wheel_id: wheel.id, status: 'skipped', reason: 'not enough participants' })
        continue
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

      // Update wheel status to spinning first
      await supabase
        .from('wheels')
        .update({ status: 'spinning' })
        .eq('id', wheel.id)

      // Build spin result
      const spinResult = {
        winner_name: winner.name,
        winner_id: winner.id,
        spun_at: new Date().toISOString(),
        final_angle: finalAngle,
      }

      const spinHistory = [...(wheel.spin_history || []), spinResult]

      // Update wheel with winner
      await supabase
        .from('wheels')
        .update({
          status: 'completed',
          winner_name: winner.name,
          winner_participant_id: winner.id,
          spin_history: spinHistory,
        })
        .eq('id', wheel.id)

      // Broadcast spin event via Realtime so all connected clients animate
      const channel = supabase.channel(`wheel:${wheel.id}`)
      await channel.send({
        type: 'broadcast',
        event: 'spin_started',
        payload: {
          final_angle: finalAngle,
          duration,
          winner_name: winner.name,
          winner_id: winner.id,
        },
      })

      results.push({ wheel_id: wheel.id, status: 'spun', winner: winner.name })
    } catch (err) {
      console.error(`Cron: error spinning wheel ${wheel.id}:`, err)
      results.push({ wheel_id: wheel.id, status: 'error', reason: String(err) })
    }
  }

  return NextResponse.json({ message: `Processed ${dueWheels.length} wheels`, results })
}
