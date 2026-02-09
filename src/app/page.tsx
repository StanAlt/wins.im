'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import WheelCanvas from '@/components/WheelCanvas'

const DEMO_NAMES = ['Alice', 'Bob', 'Carol', 'Dave', 'Eve', 'Frank']

export default function LandingPage() {
  const router = useRouter()
  const [rotation, setRotation] = useState(0)
  const [user, setUser] = useState<boolean>(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(true)
    })
  }, [])

  useEffect(() => {
    let frame: number
    let angle = 0
    const animate = () => {
      angle += 0.15
      setRotation(angle)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  const handleCTA = () => {
    router.push(user ? '/dashboard' : '/auth')
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--gradient-hero)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="text-white">wins</span>
          <span style={{ color: 'var(--color-orange)' }}>.im</span>
        </h1>
        <button
          onClick={handleCTA}
          className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] cursor-pointer"
          style={{ background: 'var(--gradient-cta)' }}
        >
          {user ? 'Dashboard' : 'Create a Wheel'}
        </button>
      </nav>

      {/* Hero */}
      <main className="flex flex-col items-center justify-center px-6 pt-12 pb-24 max-w-4xl mx-auto text-center">
        <h2
          className="text-5xl md:text-6xl font-bold mb-4 leading-tight"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Spin it.{' '}
          <span style={{ color: 'var(--color-orange)' }}>Win it.</span>
        </h2>
        <p className="text-lg text-white/60 mb-12 max-w-lg">
          The fastest way to pick a winner. Create a wheel, share the link, and let fate decide.
        </p>

        <div className="mb-12 animate-float">
          <WheelCanvas names={DEMO_NAMES} size={340} rotation={rotation} />
        </div>

        <button
          onClick={handleCTA}
          className="px-8 py-4 rounded-full text-lg font-bold text-white transition-all duration-200 hover:scale-[1.02] cursor-pointer"
          style={{ background: 'var(--gradient-cta)', boxShadow: 'var(--shadow-glow-orange)' }}
        >
          Create a Wheel — Free
        </button>
      </main>

      {/* 3 Steps */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '1', title: 'Create', desc: 'Build your wheel in seconds' },
            { step: '2', title: 'Share', desc: 'Send the link to friends' },
            { step: '3', title: 'Spin', desc: 'Hit spin and watch the magic' },
          ].map((item) => (
            <div
              key={item.step}
              className="text-center p-6 rounded-xl border border-white/[0.06]"
              style={{ background: 'var(--gradient-card)' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold mx-auto mb-4"
                style={{ background: 'var(--gradient-cta)', color: 'white' }}
              >
                {item.step}
              </div>
              <h3 className="font-bold text-lg mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
                {item.title}
              </h3>
              <p className="text-white/50 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-white/30 text-sm border-t border-white/[0.06]">
        wins.im · Built for fun
      </footer>
    </div>
  )
}
