'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import WheelCanvas from '@/components/WheelCanvas'
import WinnerOverlay from '@/components/WinnerOverlay'
import { SITE_URL, type WheelRow, type ParticipantRow } from '@/lib/constants'

export default function WheelControlPanel() {
  const router = useRouter()
  const params = useParams()
  const wheelId = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [wheel, setWheel] = useState<WheelRow | null>(null)
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [showWinner, setShowWinner] = useState(false)
  const [winnerName, setWinnerName] = useState('')
  const [copied, setCopied] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState('')
  const animRef = useRef<number | null>(null)

  const loadData = useCallback(async () => {
    const [wheelRes, participantsRes] = await Promise.all([
      supabase.from('wheels').select('*').eq('id', wheelId).single(),
      supabase.from('participants').select('*').eq('wheel_id', wheelId).order('joined_at'),
    ])
    if (wheelRes.data) setWheel(wheelRes.data)
    if (participantsRes.data) setParticipants(participantsRes.data)
    setLoading(false)
  }, [supabase, wheelId])

  useEffect(() => { loadData() }, [loadData])

  // Realtime subscription for participants
  useEffect(() => {
    const channel = supabase
      .channel(`wheel-admin:${wheelId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'participants',
        filter: `wheel_id=eq.${wheelId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setParticipants(prev => [...prev, payload.new as ParticipantRow])
        } else if (payload.eventType === 'DELETE') {
          setParticipants(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, wheelId])

  const buildSlotNames = () => {
    const names: string[] = []
    for (const p of participants) {
      for (let i = 0; i < p.slots_used; i++) {
        names.push(p.display_name)
      }
    }
    return names
  }

  const handleSpin = async () => {
    if (participants.length < 2 || spinning) return

    setSpinning(true)
    setShowWinner(false)

    const res = await fetch('/api/spin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wheel_id: wheelId }),
    })

    if (!res.ok) {
      setSpinning(false)
      return
    }

    const data = await res.json()
    const { final_angle, duration, winner_name } = data

    // Animate the wheel
    const startTime = performance.now()
    const startRotation = rotation

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Cubic bezier approximation for deceleration
      const eased = 1 - Math.pow(1 - progress, 4)
      const currentRotation = startRotation + eased * final_angle

      setRotation(currentRotation)

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        setSpinning(false)
        setWinnerName(winner_name)
        setShowWinner(true)
        loadData() // Refresh wheel data
      }
    }

    animRef.current = requestAnimationFrame(animate)
  }

  const handleUpdateField = async (field: string, value: string | number | boolean | null) => {
    if (!wheel) return
    await supabase.from('wheels').update({ [field]: value }).eq('id', wheelId)
    setWheel({ ...wheel, [field]: value })
  }

  const handleRemoveParticipant = async (participantId: string) => {
    await supabase.from('participants').delete().eq('id', participantId)
    setParticipants(prev => prev.filter(p => p.id !== participantId))
  }

  const handleAddParticipant = async () => {
    if (!wheel || !newName.trim()) return
    setAddError('')

    // Check max participants
    if (wheel.max_participants && participants.length >= wheel.max_participants) {
      setAddError('Wheel is full')
      return
    }

    // Case-insensitive duplicate check
    const nameLower = newName.trim().toLowerCase()
    if (participants.some(p => p.display_name.toLowerCase() === nameLower)) {
      setAddError('Name already taken')
      return
    }

    const { error: insertError } = await supabase
      .from('participants')
      .insert({ wheel_id: wheelId, display_name: newName.trim() })

    if (insertError) {
      setAddError(insertError.code === '23505' ? 'Name already taken' : 'Could not add')
    } else {
      setNewName('')
    }
  }

  const handleStatusChange = async (status: 'open' | 'closed') => {
    await handleUpdateField('status', status)
  }

  const handleReset = async () => {
    await supabase.from('wheels').update({
      status: 'open',
      winner_name: null,
      winner_participant_id: null,
    }).eq('id', wheelId)
    setShowWinner(false)
    setRotation(0)
    loadData()
  }

  const copyLink = () => {
    if (!wheel) return
    navigator.clipboard.writeText(`${SITE_URL}/w/${wheel.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || !wheel) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
        <div className="text-white/50">Loading...</div>
      </div>
    )
  }

  const slotNames = buildSlotNames()
  const totalSlots = slotNames.length

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-hero)' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto border-b border-white/[0.06]">
        <h1
          className="text-2xl font-bold cursor-pointer"
          style={{ fontFamily: 'var(--font-display)' }}
          onClick={() => router.push('/dashboard')}
        >
          <span className="text-white">wins</span>
          <span style={{ color: 'var(--color-orange)' }}>.im</span>
        </h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-white/40 hover:text-white/70 transition-colors cursor-pointer"
        >
          Back to Dashboard
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left: Controls */}
          <div className="w-full lg:w-80 space-y-6 shrink-0">
            {/* Title */}
            <div>
              <label className="block text-xs text-white/40 mb-1">Title</label>
              <input
                type="text"
                value={wheel.title}
                onChange={(e) => setWheel({ ...wheel, title: e.target.value })}
                onBlur={(e) => handleUpdateField('title', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {/* Prize */}
            <div>
              <label className="block text-xs text-white/40 mb-1">Prize description</label>
              <input
                type="text"
                value={wheel.prize_description || ''}
                onChange={(e) => setWheel({ ...wheel, prize_description: e.target.value })}
                onBlur={(e) => handleUpdateField('prize_description', e.target.value || null)}
                placeholder="What does the winner get?"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors placeholder:text-white/20"
              />
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/40 mb-1">Spots per user</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={wheel.max_slots_per_user}
                  onChange={(e) => handleUpdateField('max_slots_per_user', parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1">Max participants</label>
                <input
                  type="number"
                  min={2}
                  value={wheel.max_participants || ''}
                  onChange={(e) => handleUpdateField('max_participants', e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="∞"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors placeholder:text-white/30"
                />
              </div>
            </div>

            {/* Theme */}
            <div>
              <label className="block text-xs text-white/40 mb-1">Theme</label>
              <select
                value={wheel.theme}
                onChange={(e) => handleUpdateField('theme', e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors cursor-pointer"
                style={{ colorScheme: 'dark' }}
              >
                <option value="default" className="bg-[#132240] text-white">Default</option>
                <option value="neon" className="bg-[#132240] text-white">Neon</option>
                <option value="minimal" className="bg-[#132240] text-white">Minimal</option>
                <option value="dark" className="bg-[#132240] text-white">Dark</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wheel.show_confetti}
                  onChange={(e) => handleUpdateField('show_confetti', e.target.checked)}
                  className="rounded cursor-pointer"
                />
                Confetti
              </label>
              <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wheel.sound_enabled}
                  onChange={(e) => handleUpdateField('sound_enabled', e.target.checked)}
                  className="rounded cursor-pointer"
                />
                Sound
              </label>
            </div>

            {/* Scheduled spin */}
            <div>
              <label className="block text-xs text-white/40 mb-1">Scheduled spin</label>
              <input
                type="datetime-local"
                value={wheel.spin_at ? new Date(new Date(wheel.spin_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
                onChange={(e) => {
                  const val = e.target.value ? new Date(e.target.value).toISOString() : null
                  handleUpdateField('spin_at', val)
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                style={{ colorScheme: 'dark' }}
              />
              {wheel.spin_at && (
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-white/30">
                    Spins {new Date(wheel.spin_at).toLocaleString()}
                  </span>
                  <button
                    onClick={() => handleUpdateField('spin_at', null)}
                    className="text-xs text-white/30 hover:text-white/60 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Participants list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/40">Participants</label>
                <span className="text-xs text-white/30">
                  {participants.length} joined · {totalSlots}{wheel.max_participants ? `/${wheel.max_participants}` : '/∞'} slots
                </span>
              </div>

              {/* Admin add name */}
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setAddError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
                  placeholder="Add a name..."
                  maxLength={30}
                  className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-orange-500 transition-colors placeholder:text-white/20"
                />
                <button
                  onClick={handleAddParticipant}
                  disabled={!newName.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors cursor-pointer disabled:opacity-30"
                  style={{ background: 'var(--gradient-cta)' }}
                >
                  Add
                </button>
              </div>
              {addError && (
                <p className="text-xs mb-2" style={{ color: '#FF4F6F' }}>{addError}</p>
              )}

              <div
                className="rounded-lg border border-white/[0.06] max-h-60 overflow-y-auto"
                style={{ background: 'var(--gradient-card)' }}
              >
                {participants.length === 0 ? (
                  <div className="p-4 text-center text-white/30 text-sm">No participants yet</div>
                ) : (
                  participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3 py-2 border-b border-white/[0.04] last:border-0"
                    >
                      <span className="text-sm text-white/80">{p.display_name}</span>
                      <button
                        onClick={() => handleRemoveParticipant(p.id)}
                        className="text-white/20 hover:text-red-400 transition-colors text-sm cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Shareable link */}
            <div>
              <label className="block text-xs text-white/40 mb-1">Shareable link</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-white/5 text-xs text-white/50 truncate">
                  {`${SITE_URL}/w/${wheel.slug}`}
                </code>
                <button
                  onClick={copyLink}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/60 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Status controls */}
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange('open')}
                disabled={wheel.status === 'open'}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-30"
                style={{ backgroundColor: wheel.status === 'open' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.05)', color: wheel.status === 'open' ? '#22C55E' : 'rgba(255,255,255,0.5)' }}
              >
                Open Entries
              </button>
              <button
                onClick={() => handleStatusChange('closed')}
                disabled={wheel.status === 'closed'}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-30"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}
              >
                Close Entries
              </button>
              <button
                onClick={handleReset}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-white/5 text-white/50 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* Spin History */}
            {wheel.spin_history && wheel.spin_history.length > 0 && (
              <div>
                <label className="block text-xs text-white/40 mb-2">Spin History</label>
                <div className="space-y-1">
                  {wheel.spin_history.map((spin, i) => (
                    <div key={i} className="text-xs text-white/40 flex items-center gap-2">
                      <span className="text-white/20">#{i + 1}</span>
                      <span className="text-white/60">{spin.winner_name} won</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Wheel */}
          <div className="flex-1 flex flex-col items-center justify-start pt-4">
            <div className="mb-8">
              <WheelCanvas
                names={slotNames}
                size={Math.min(500, typeof window !== 'undefined' ? window.innerWidth - 400 : 500)}
                rotation={rotation}
                spinning={spinning}
              />
            </div>

            <button
              onClick={handleSpin}
              disabled={participants.length < 2 || spinning}
              className="px-12 py-4 rounded-full text-xl font-bold text-white transition-all duration-200 hover:scale-[1.02] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              style={{ background: 'var(--gradient-cta)', boxShadow: spinning ? 'none' : 'var(--shadow-glow-orange)' }}
            >
              {spinning ? 'Spinning...' : 'SPIN'}
            </button>

            {wheel.status === 'completed' && !spinning && (
              <button
                onClick={handleSpin}
                className="mt-4 px-6 py-2 rounded-full text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                Spin Again
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Winner overlay */}
      {showWinner && wheel.show_confetti && (
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
