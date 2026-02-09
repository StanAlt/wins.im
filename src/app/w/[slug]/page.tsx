'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'
import WheelCanvas from '@/components/WheelCanvas'
import WinnerOverlay from '@/components/WinnerOverlay'
import type { WheelRow, ParticipantRow } from '@/lib/constants'

export default function PublicWheelPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createClient()

  const [wheel, setWheel] = useState<WheelRow | null>(null)
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [showWinner, setShowWinner] = useState(false)
  const [winnerName, setWinnerName] = useState('')
  const [countdown, setCountdown] = useState('')

  const loadData = useCallback(async () => {
    const { data: wheelData } = await supabase
      .from('wheels')
      .select('*')
      .eq('slug', slug)
      .single()

    if (wheelData) {
      setWheel(wheelData)
      const { data: participantData } = await supabase
        .from('participants')
        .select('*')
        .eq('wheel_id', wheelData.id)
        .order('joined_at')
      if (participantData) setParticipants(participantData)

      // Show winner if already completed
      if (wheelData.status === 'completed' && wheelData.winner_name) {
        setWinnerName(wheelData.winner_name)
        setShowWinner(true)
      }
    }
    setLoading(false)
  }, [supabase, slug])

  useEffect(() => { loadData() }, [loadData])

  // Countdown timer for scheduled spin
  useEffect(() => {
    if (!wheel?.spin_at || wheel.status === 'completed') return

    const update = () => {
      const now = Date.now()
      const target = new Date(wheel.spin_at!).getTime()
      const diff = target - now

      if (diff <= 0) {
        setCountdown('')
        return
      }

      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const mins = Math.floor((diff % 3600000) / 60000)
      const secs = Math.floor((diff % 60000) / 1000)

      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${mins}m`)
      } else if (hours > 0) {
        setCountdown(`${hours}h ${mins}m ${secs}s`)
      } else {
        setCountdown(`${mins}m ${secs}s`)
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [wheel?.spin_at, wheel?.status])

  // Realtime: participants
  useEffect(() => {
    if (!wheel) return

    const channel = supabase
      .channel(`wheel-public:${wheel.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'participants',
        filter: `wheel_id=eq.${wheel.id}`,
      }, (payload) => {
        setParticipants(prev => [...prev, payload.new as ParticipantRow])
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'participants',
        filter: `wheel_id=eq.${wheel.id}`,
      }, (payload) => {
        setParticipants(prev => prev.filter(p => p.id !== payload.old.id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, wheel])

  // Realtime: spin broadcast
  useEffect(() => {
    if (!wheel) return

    const channel = supabase
      .channel(`wheel:${wheel.id}`)
      .on('broadcast', { event: 'spin_started' }, (payload) => {
        const { final_angle, duration, winner_name } = payload.payload

        setSpinning(true)
        setShowWinner(false)

        const startTime = performance.now()
        const startRotation = rotation

        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime
          const progress = Math.min(elapsed / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 4)
          const currentRotation = startRotation + eased * final_angle
          setRotation(currentRotation)

          if (progress < 1) {
            requestAnimationFrame(animate)
          } else {
            setSpinning(false)
            setWinnerName(winner_name)
            setShowWinner(true)
          }
        }
        requestAnimationFrame(animate)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, wheel, rotation])

  // Realtime: wheel status changes
  useEffect(() => {
    if (!wheel) return

    const channel = supabase
      .channel(`wheel-status:${wheel.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'wheels',
        filter: `id=eq.${wheel.id}`,
      }, (payload) => {
        const updated = payload.new as WheelRow
        setWheel(updated)
        if (updated.status === 'completed' && updated.winner_name) {
          setWinnerName(updated.winner_name)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, wheel])

  const buildSlotNames = () => {
    const names: string[] = []
    for (const p of participants) {
      for (let i = 0; i < p.slots_used; i++) {
        names.push(p.display_name)
      }
    }
    return names
  }

  const handleJoin = async () => {
    if (!wheel || !name.trim()) return
    setJoining(true)
    setError('')

    // Check max participants
    if (wheel.max_participants && participants.length >= wheel.max_participants) {
      setError('This wheel is full')
      setJoining(false)
      return
    }

    // Client-side case-insensitive duplicate check
    const nameLower = name.trim().toLowerCase()
    if (participants.some(p => p.display_name.toLowerCase() === nameLower)) {
      setError('That name is already taken')
      setJoining(false)
      return
    }

    const { error: insertError } = await supabase
      .from('participants')
      .insert({
        wheel_id: wheel.id,
        display_name: name.trim(),
      })

    if (insertError) {
      if (insertError.code === '23505') {
        setError('That name is already taken')
      } else {
        setError('Could not join. Try again.')
      }
    } else {
      setName('')
    }
    setJoining(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <div className="text-white/50">Loading...</div>
      </div>
    )
  }

  if (!wheel) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <div className="text-white/50">Wheel not found</div>
      </div>
    )
  }

  const slotNames = buildSlotNames()

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-hero)' }}>
      {/* Header */}
      <header className="text-center py-4 border-b border-white/[0.06]">
        <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="text-white">wins</span>
          <span style={{ color: 'var(--color-orange)' }}>.im</span>
        </h1>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Wheel info */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            {wheel.title}
          </h2>
          {wheel.prize_description && (
            <p className="text-white/50">Prize: {wheel.prize_description}</p>
          )}
        </div>

        {/* Wheel */}
        <div className="flex justify-center mb-8">
          <WheelCanvas
            names={slotNames}
            size={Math.min(400, typeof window !== 'undefined' ? window.innerWidth - 48 : 400)}
            rotation={rotation}
            spinning={spinning}
          />
        </div>

        {/* Join form (if open) */}
        {wheel.status === 'open' && (
          <div className="mb-8">
            <div className="flex gap-2 max-w-sm mx-auto">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Your name"
                maxLength={30}
                className="flex-1 px-4 py-3 rounded-full bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors placeholder:text-white/20"
              />
              <button
                onClick={handleJoin}
                disabled={joining || !name.trim()}
                className="px-6 py-3 rounded-full font-semibold text-white text-sm transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
                style={{ background: 'var(--gradient-cta)' }}
              >
                {joining ? '...' : 'Join'}
              </button>
            </div>
            {error && (
              <p className="text-center text-sm mt-2" style={{ color: 'var(--color-coral)' }}>{error}</p>
            )}
          </div>
        )}

        {/* Status messages */}
        {wheel.status === 'spinning' && (
          <div className="text-center py-4">
            <p className="text-lg font-bold animate-pulse" style={{ color: 'var(--color-orange)', fontFamily: 'var(--font-display)' }}>
              Spinning!
            </p>
          </div>
        )}

        {wheel.status === 'closed' && (
          <div className="text-center py-4">
            <p className="text-white/50">This wheel is closed</p>
          </div>
        )}

        {/* Participants */}
        <div className="mt-6">
          <h3 className="text-sm text-white/40 mb-3 text-center">
            Participants ({participants.length})
          </h3>
          <div className="flex flex-wrap justify-center gap-2">
            {participants.map((p) => (
              <span
                key={p.id}
                className="px-3 py-1 rounded-full text-sm bg-white/5 text-white/60 border border-white/[0.06]"
              >
                {p.display_name}
              </span>
            ))}
          </div>
          {participants.length === 0 && (
            <p className="text-center text-white/30 text-sm">No participants yet</p>
          )}
        </div>

        {/* Scheduled spin countdown */}
        {wheel.spin_at && wheel.status === 'open' && countdown && (
          <div className="text-center mt-6 p-4 rounded-xl border border-white/[0.06]" style={{ background: 'var(--gradient-card)' }}>
            <p className="text-xs text-white/40 mb-1">Spin scheduled in</p>
            <p className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-orange)' }}>
              {countdown}
            </p>
          </div>
        )}

        {/* Persistent winner display (always visible when completed) */}
        {wheel.status === 'completed' && wheel.winner_name && !spinning && (
          <div className="text-center mt-6 p-6 rounded-xl border border-orange-500/20" style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-glow-orange)' }}>
            <p className="text-xs text-white/40 mb-1 uppercase tracking-widest">Winner</p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-orange)' }}>
              {wheel.winner_name}
            </p>
            {wheel.prize_description && (
              <p className="text-white/50 text-sm mt-2">{wheel.prize_description}</p>
            )}
          </div>
        )}

        {/* Waiting message */}
        {wheel.status === 'open' && participants.length > 0 && !countdown && (
          <div className="text-center mt-8">
            <p className="text-white/30 text-sm">Waiting for host to spin...</p>
          </div>
        )}
      </main>

      {/* Winner overlay */}
      {showWinner && (
        <WinnerOverlay
          winnerName={winnerName}
          prize={wheel.prize_description}
          onClose={() => setShowWinner(false)}
          showConfetti={wheel.show_confetti}
        />
      )}
    </div>
  )
}
