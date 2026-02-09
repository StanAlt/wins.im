'use client'

import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { CONFETTI_COLORS } from '@/lib/constants'

interface WinnerOverlayProps {
  winnerName: string
  prize: string | null
  onClose: () => void
  showConfetti: boolean
}

export default function WinnerOverlay({ winnerName, prize, onClose, showConfetti }: WinnerOverlayProps) {
  useEffect(() => {
    if (showConfetti) {
      const burst = () => {
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { x: 0.5, y: 0.5 },
          colors: CONFETTI_COLORS,
          startVelocity: 45,
          gravity: 0.8,
        })
      }
      burst()
      const t1 = setTimeout(burst, 300)
      const t2 = setTimeout(burst, 700)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [showConfetti])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(10, 22, 40, 0.9)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="text-center p-12 rounded-2xl max-w-lg mx-4"
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--gradient-card)', boxShadow: 'var(--shadow-elevated)' }}
      >
        <div className="text-lg text-white/40 mb-2 font-medium tracking-widest uppercase">Winner</div>

        <h2
          className="text-5xl md:text-6xl font-bold mb-4 animate-pulse-glow inline-block px-4 py-2 rounded-xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-orange)' }}
        >
          {winnerName}
        </h2>

        {prize && (
          <p className="text-lg text-white/60 mt-4 mb-6">{prize}</p>
        )}

        <button
          onClick={onClose}
          className="mt-6 px-6 py-2 rounded-full text-sm font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    </div>
  )
}
