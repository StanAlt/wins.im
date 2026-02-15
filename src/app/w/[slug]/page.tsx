'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import WheelCanvas from '@/components/WheelCanvas'
import WinnerOverlay from '@/components/WinnerOverlay'
import type { WheelRow, ParticipantRow } from '@/lib/constants'

export default function PublicWheelPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const supabase = useMemo(() => createClient(), [])
  const autoSpinTriggered = useRef(false)
  const animRef = useRef<number | null>(null)
  const rotationRef = useRef(0)

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
  const [mySpots, setMySpots] = useState(0)
  const [justJoined, setJustJoined] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // Track how many spots this user has added (per wheel, via localStorage)
  const getMySpots = useCallback((wheelId: string): string[] => {
    try {
      const stored = localStorage.getItem(`wins-spots-${wheelId}`)
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  }, [])

  const addMySpot = useCallback((wheelId: string, displayName: string) => {
    const spots = getMySpots(wheelId)
    spots.push(displayName)
    localStorage.setItem(`wins-spots-${wheelId}`, JSON.stringify(spots))
    setMySpots(spots.length)
  }, [getMySpots])

  // Start the spin animation
  const startSpinAnimation = useCallback((finalAngle: number, duration: number, winner: string) => {
    if (animRef.current) cancelAnimationFrame(animRef.current)

    setSpinning(true)
    setShowWinner(false)

    const startTime = performance.now()
    const startRotation = rotationRef.current

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      const currentRotation = startRotation + eased * finalAngle

      rotationRef.current = currentRotation
      setRotation(currentRotation)

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        animRef.current = null
        setSpinning(false)
        setWinnerName(winner)
        setShowWinner(true)
      }
    }
    animRef.current = requestAnimationFrame(animate)
  }, [])

  const loadData = useCallback(async () => {
    const { data: wheelData } = await supabase
      .from('wheels')
      .select('*')
      .eq('slug', slug)
      .single()

    if (wheelData) {
      setWheel(wheelData)
      setMySpots(getMySpots(wheelData.id).length)
      const { data: participantData } = await supabase
        .from('participants')
        .select('*')
        .eq('wheel_id', wheelData.id)
        .order('joined_at')
      if (participantData) setParticipants(participantData)

      // Show winner if already completed (don't re-animate on page load)
      if (wheelData.status === 'completed' && wheelData.winner_name) {
        setWinnerName(wheelData.winner_name)
        setShowWinner(true)
      }
    }
    setLoading(false)
  }, [supabase, slug, getMySpots, startSpinAnimation])

  useEffect(() => { loadData() }, [loadData])

  // Auto-spin trigger: when countdown reaches zero, call the auto-spin endpoint
  const triggerAutoSpin = useCallback(async (wheelId: string) => {
    if (autoSpinTriggered.current) return
    autoSpinTriggered.current = true

    try {
      const res = await fetch('/api/auto-spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wheel_id: wheelId }),
      })

      if (!res.ok) {
        await loadData()
      }
    } catch {
      await loadData()
    }
  }, [loadData])

  // Countdown timer for scheduled spin
  useEffect(() => {
    if (!wheel?.spin_at || wheel.status === 'completed') return

    const update = () => {
      const now = Date.now()
      const target = new Date(wheel.spin_at!).getTime()
      const diff = target - now

      if (diff <= 0) {
        setCountdown('')
        triggerAutoSpin(wheel.id)
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
  }, [wheel?.spin_at, wheel?.status, wheel?.id, triggerAutoSpin])

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

  // Realtime: wheel updates (status changes, spin data)
  // When the server updates the wheel with spin_final_angle, we animate!
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

        // Check if this update contains spin animation data
        if (updated.spin_final_angle && updated.spin_duration && updated.spin_winner_name && !spinning) {
          // Start the spin animation!
          setWheel(updated)
          startSpinAnimation(updated.spin_final_angle, updated.spin_duration, updated.spin_winner_name)
        } else if (!spinning) {
          // Regular update (status change, etc.) — only update if not mid-animation
          setWheel(updated)
          if (updated.status === 'completed' && updated.winner_name && !updated.spin_final_angle) {
            // Legacy spin without animation data
            setWinnerName(updated.winner_name)
            setShowWinner(true)
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, wheel, spinning, startSpinAnimation])

  const buildSlotNames = () => {
    const names: string[] = []
    for (const p of participants) {
      for (let i = 0; i < p.slots_used; i++) {
        names.push(p.display_name)
      }
    }
    return names
  }

  const spotsRemaining = wheel ? wheel.max_slots_per_user - mySpots : 0
  const hasReachedLimit = wheel ? mySpots >= wheel.max_slots_per_user : false

  const handleJoin = async () => {
    if (!wheel || !name.trim()) return
    setJoining(true)
    setError('')

    if (hasReachedLimit) {
      setError(`You've used all ${wheel.max_slots_per_user} of your spots`)
      setJoining(false)
      return
    }

    if (wheel.max_participants && participants.length >= wheel.max_participants) {
      setError('This wheel is full')
      setJoining(false)
      return
    }

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
      addMySpot(wheel.id, name.trim())
      setName('')
      setJustJoined(true)
      setTimeout(() => setJustJoined(false), 3000)
    }
    setJoining(false)
  }

  const handleShareLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-orange-500 rounded-full animate-spin" />
          <div className="text-white/40 text-sm">Loading wheel...</div>
        </div>
      </div>
    )
  }

  if (!wheel) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <div className="text-center">
          <div className="text-4xl mb-4 opacity-50">?</div>
          <div className="text-white/50 mb-4">Wheel not found</div>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 rounded-full text-sm font-medium text-white transition-all hover:scale-[1.02] cursor-pointer"
            style={{ background: 'var(--gradient-cta)' }}
          >
            Create Your Own
          </button>
        </div>
      </div>
    )
  }

  const slotNames = buildSlotNames()

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-hero)' }}>
      {/* Header with CTA logo */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <button
          onClick={() => router.push('/')}
          className="text-xl font-bold transition-opacity hover:opacity-80 cursor-pointer"
          style={{ fontFamily: 'var(--font-display)' }}
          title="Create your own wheel!"
        >
          <span className="text-white">wins</span>
          <span style={{ color: 'var(--color-orange)' }}>.im</span>
        </button>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-1.5 rounded-full text-xs font-semibold text-white transition-all hover:scale-[1.02] cursor-pointer"
          style={{ background: 'var(--gradient-cta)' }}
        >
          Create Your Own
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Wheel info */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            {wheel.title}
          </h2>
          {wheel.prize_description && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/[0.06]">
              <span className="text-sm text-white/50">Prize:</span>
              <span className="text-sm font-medium text-white/80">{wheel.prize_description}</span>
            </div>
          )}
        </div>

        {/* Wheel */}
        <div className="flex justify-center mb-8">
          <WheelCanvas
            names={slotNames}
            size={Math.min(400, typeof window !== 'undefined' ? window.innerWidth - 48 : 400)}
            rotation={rotation}
            spinning={spinning}
            theme={wheel.theme}
          />
        </div>

        {/* Spinning indicator */}
        {spinning && (
          <div className="text-center py-4">
            <p className="text-lg font-bold animate-pulse" style={{ color: 'var(--color-orange)', fontFamily: 'var(--font-display)' }}>
              Spinning!
            </p>
          </div>
        )}

        {/* Join form (if open and not spinning) */}
        {wheel.status === 'open' && !spinning && (
          <div className="mb-8">
            {justJoined && (
              <div className="text-center mb-4 animate-fade-in">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm text-green-400 font-medium">You&apos;re in! Good luck!</span>
                </div>
              </div>
            )}
            {hasReachedLimit ? (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/[0.06]">
                  <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-white/40 text-sm">
                    You&apos;ve used all {wheel.max_slots_per_user} of your {wheel.max_slots_per_user === 1 ? 'spot' : 'spots'}
                  </p>
                </div>
              </div>
            ) : (
              <>
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
                {wheel.max_slots_per_user > 1 && (
                  <p className="text-center text-xs text-white/30 mt-2">
                    {spotsRemaining} {spotsRemaining === 1 ? 'spot' : 'spots'} remaining
                  </p>
                )}
              </>
            )}
            {error && (
              <p className="text-center text-sm mt-2" style={{ color: '#FF4F6F' }}>{error}</p>
            )}
          </div>
        )}

        {/* Closed status */}
        {wheel.status === 'closed' && !spinning && (
          <div className="text-center py-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/[0.06]">
              <div className="w-2 h-2 rounded-full bg-white/30" />
              <p className="text-white/50 text-sm">This wheel is closed</p>
            </div>
          </div>
        )}

        {/* Participants */}
        <div className="mt-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <h3 className="text-sm text-white/40">
              Participants
            </h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-white/5 border border-white/[0.06] text-white/50">
              {participants.length}
            </span>
            {wheel.max_participants && (
              <span className="text-xs text-white/20">/ {wheel.max_participants}</span>
            )}
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {participants.map((p, i) => (
              <span
                key={p.id}
                className="px-3 py-1 rounded-full text-sm bg-white/5 text-white/60 border border-white/[0.06] transition-all"
                style={{
                  animationDelay: `${i * 50}ms`,
                }}
              >
                {p.display_name}
              </span>
            ))}
          </div>
          {participants.length === 0 && (
            <p className="text-center text-white/30 text-sm">No participants yet &mdash; be the first!</p>
          )}
        </div>

        {/* Share link button */}
        {wheel.status === 'open' && participants.length > 0 && !spinning && (
          <div className="text-center mt-6">
            <button
              onClick={handleShareLink}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs text-white/40 bg-white/5 hover:bg-white/10 border border-white/[0.06] transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              {copiedLink ? 'Link copied!' : 'Share this wheel'}
            </button>
          </div>
        )}

        {/* Scheduled spin countdown */}
        {wheel.spin_at && wheel.status === 'open' && countdown && !spinning && (
          <div className="text-center mt-6 p-4 rounded-xl border border-white/[0.06]" style={{ background: 'var(--gradient-card)' }}>
            <p className="text-xs text-white/40 mb-1">Spin scheduled in</p>
            <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-orange)' }}>
              {countdown}
            </p>
            <div className="mt-2 w-full bg-white/5 rounded-full h-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  background: 'var(--gradient-cta)',
                  width: wheel.spin_at ? `${Math.max(2, 100 - ((new Date(wheel.spin_at).getTime() - Date.now()) / (new Date(wheel.spin_at).getTime() - new Date(wheel.created_at).getTime())) * 100)}%` : '0%',
                }}
              />
            </div>
          </div>
        )}

        {/* Persistent winner display (always visible when completed and not spinning) */}
        {wheel.status === 'completed' && wheel.winner_name && !spinning && (
          <div className="text-center mt-6 p-6 rounded-xl border border-orange-500/20 animate-fade-in" style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-glow-orange)' }}>
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
        {wheel.status === 'open' && participants.length > 0 && !countdown && !spinning && (
          <div className="text-center mt-8">
            <div className="inline-flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-white/30 text-sm">Live &mdash; waiting for host to spin...</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer CTA */}
      <footer className="text-center py-6 border-t border-white/[0.06]">
        <button
          onClick={() => router.push('/')}
          className="text-white/30 text-sm hover:text-white/50 transition-colors cursor-pointer"
        >
          Create your own wheel at <span style={{ color: 'var(--color-orange)' }}>wins.im</span>
        </button>
      </footer>

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
