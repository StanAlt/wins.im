'use client'

import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { CONFETTI_COLORS } from '@/lib/constants'

interface WinnerOverlayProps {
  winnerName: string
  prize: string | null
  onClose: () => void
  showConfetti: boolean
}

export default function WinnerOverlay({ winnerName, prize, onClose, showConfetti }: WinnerOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setVisible(true))

    if (showConfetti) {
      const burst = (opts?: confetti.Options) => {
        confetti({
          particleCount: 80,
          spread: 100,
          origin: { x: 0.5, y: 0.5 },
          colors: CONFETTI_COLORS,
          startVelocity: 45,
          gravity: 0.8,
          ...opts,
        })
      }

      // Staggered bursts for dramatic effect
      burst()
      const t1 = setTimeout(() => burst({ origin: { x: 0.3, y: 0.6 }, spread: 70 }), 300)
      const t2 = setTimeout(() => burst({ origin: { x: 0.7, y: 0.6 }, spread: 70 }), 500)
      const t3 = setTimeout(() => burst({ particleCount: 120, spread: 140 }), 800)

      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
        clearTimeout(t3)
      }
    }
  }, [showConfetti])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 200)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center transition-all duration-300"
      style={{
        background: visible ? 'rgba(10, 22, 40, 0.9)' : 'rgba(10, 22, 40, 0)',
        backdropFilter: visible ? 'blur(8px)' : 'blur(0px)',
      }}
      onClick={handleClose}
    >
      <div
        className="text-center p-12 rounded-2xl max-w-lg mx-4 transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--gradient-card)',
          boxShadow: 'var(--shadow-elevated), 0 0 60px rgba(255, 107, 44, 0.2)',
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.8) translateY(20px)',
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Trophy icon */}
        <div className="text-5xl mb-2">
          <span className="inline-block animate-float" style={{ animationDuration: '2s' }}>
            &#127942;
          </span>
        </div>

        <div className="text-lg text-white/40 mb-2 font-medium tracking-widest uppercase">Winner</div>

        <h2
          className="text-5xl md:text-6xl font-bold mb-4 animate-pulse-glow inline-block px-4 py-2 rounded-xl"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-orange)' }}
        >
          {winnerName}
        </h2>

        {prize && (
          <div className="mt-4 mb-6 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/[0.06]">
            <span className="text-lg text-white/60">{prize}</span>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={handleClose}
            className="px-8 py-2.5 rounded-full text-sm font-medium text-white bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer border border-white/[0.06]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
