'use client'

import { createBrowserClient } from '@supabase/ssr'
import { parse } from 'cookie'
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

      // Log raw document.cookie
      const rawCookie = document.cookie
      log(`Raw cookie length: ${rawCookie.length}`)
      log(`Raw cookie (first 200): ${rawCookie.substring(0, 200)}`)

      // Split manually
      const parts = rawCookie.split(';').map(c => c.trim())
      log(`Split parts: ${parts.length}`)
      parts.forEach((p, i) => {
        const eqPos = p.indexOf('=')
        const name = eqPos > -1 ? p.substring(0, eqPos) : p
        const valPreview = eqPos > -1 ? p.substring(eqPos + 1, eqPos + 30) : '(no =)'
        log(`  [${i}] name="${name}" val="${valPreview}..."`)
      })

      const hasVerifier = parts.some(p => p.includes('code-verifier'))
      log(`Has code-verifier: ${hasVerifier}`)

      const code = new URLSearchParams(window.location.search).get('code')
      if (!code) {
        log('ERROR: No code in URL')
        return
      }
      log(`Code: ${code.substring(0, 8)}...`)

      // Create a FRESH non-singleton client specifically for this exchange.
      // We disable detectSessionInUrl so initialize() won't race with us,
      // and set isSingleton: false to avoid the cached client.
      log('Creating fresh non-singleton client...')
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          isSingleton: false,
          cookieOptions: {
            domain: '.wins.im',
            path: '/',
            sameSite: 'lax' as const,
            secure: true,
          },
          auth: {
            detectSessionInUrl: false,
            autoRefreshToken: false,
            persistSession: true,
            flowType: 'pkce',
          },
        }
      )

      log('Calling exchangeCodeForSession...')
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        log(`ERROR: ${error.message}`)
        // Try to read what getItem would return
        try {
          const storageKey = `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`
          const verifierKey = `${storageKey}-code-verifier`
          log(`Expected storage key: ${verifierKey}`)

          // Manually check what parse() returns
          const parsed = parse(document.cookie)
          const parsedKeys = Object.keys(parsed)
          log(`parse() found ${parsedKeys.length} cookies: ${parsedKeys.join(', ')}`)

          if (parsed[verifierKey]) {
            log(`parse() HAS verifier: ${parsed[verifierKey].substring(0, 40)}...`)
          } else {
            log(`parse() does NOT have verifier key`)
            // Check for partial matches
            const partials = parsedKeys.filter(k => k.includes('code-verifier'))
            if (partials.length > 0) {
              log(`Partial matches: ${partials.join(', ')}`)
            }
          }
        } catch (e) {
          log(`Debug error: ${e}`)
        }
        return
      }

      log(`Success! User: ${data.user?.email}`)
      setTimeout(() => router.replace('/dashboard'), 1500)
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
