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
      // Log all cookies visible to this page
      const allCookies = document.cookie
      const cookieNames = allCookies
        ? allCookies.split(';').map(c => c.trim().split('=')[0])
        : []

      log(`URL: ${window.location.href}`)
      log(`Cookie count: ${cookieNames.length}`)
      log(`Cookie names: ${cookieNames.join(', ') || '(none)'}`)

      const hasVerifier = cookieNames.some(n => n.includes('code-verifier'))
      log(`Has code-verifier: ${hasVerifier}`)

      if (hasVerifier) {
        const verifierCookie = allCookies
          .split(';')
          .map(c => c.trim())
          .find(c => c.includes('code-verifier'))
        log(`Verifier cookie: ${verifierCookie?.substring(0, 60)}...`)
      }

      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (!code) {
        log('ERROR: No code in URL params')
        // Don't redirect — show debug
        return
      }

      log(`Code: ${code.substring(0, 8)}...`)
      log('Creating Supabase client...')

      const supabase = createClient()

      log('Calling exchangeCodeForSession...')
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        log(`ERROR: ${error.message}`)
        // Don't redirect — show debug info
        return
      }

      log(`Success! User: ${data.user?.email}`)

      // Wait 2s so user can see success, then redirect
      setTimeout(() => router.replace('/dashboard'), 2000)
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
