'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const processed = useRef(false)
  const [debug, setDebug] = useState<string[]>([])

  const log = (msg: string) => {
    console.log('[CALLBACK]', msg)
    setDebug(prev => [...prev, msg])
  }

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const handleCallback = async () => {
      log(`URL: ${window.location.href}`)

      // createClient() triggers GoTrueClient.initialize() which automatically
      // detects the ?code= param (via detectSessionInUrl) and calls
      // _exchangeCodeForSession internally. We must NOT call exchangeCodeForSession
      // manually — that would race with initialize and fail because the
      // code-verifier cookie is consumed on the first exchange attempt.
      const supabase = createClient()

      log('Waiting for auto-initialization to complete...')

      // Listen for auth state changes — initialize() will fire SIGNED_IN
      // once it successfully exchanges the code
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        log(`Auth event: ${event}`)
        if (event === 'SIGNED_IN' && session) {
          log(`Success! User: ${session.user?.email}`)
          subscription.unsubscribe()
          router.replace('/dashboard')
        }
      })

      // Also poll getSession as a fallback — initialize() may have already
      // completed by the time onAuthStateChange is registered
      const checkSession = async () => {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          log(`ERROR from getSession: ${error.message}`)
          return
        }
        if (session) {
          log(`Session found! User: ${session.user?.email}`)
          subscription.unsubscribe()
          router.replace('/dashboard')
          return
        }
        log('No session yet, retrying in 500ms...')
      }

      // Wait a bit for initialize to complete, then check
      setTimeout(checkSession, 1000)
      setTimeout(checkSession, 2500)
      setTimeout(checkSession, 5000)

      // Final timeout — if still no session after 8s, something went wrong
      setTimeout(() => {
        log('ERROR: Timed out waiting for session after 8 seconds')
      }, 8000)
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--gradient-hero)' }}>
      <div className="text-white/60 text-sm">Signing you in...</div>
      {debug.length > 0 && (
        <div className="w-full max-w-lg p-4 rounded-xl bg-black/50 border border-white/10 font-mono text-xs text-green-400 space-y-1 overflow-auto max-h-80">
          {debug.map((msg, i) => (
            <div key={i} className={msg.startsWith('ERROR') ? 'text-red-400' : ''}>
              {msg}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
