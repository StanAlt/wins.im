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

      const code = new URLSearchParams(window.location.search).get('code')
      if (!code) {
        log('ERROR: No code in URL')
        return
      }
      log(`Code: ${code.substring(0, 8)}...`)

      // Read verifier DIRECTLY from document.cookie before creating any client
      const rawCookie = document.cookie
      const verifierCookieName = 'sb-pzxaidqhlwlluyiqydqz-auth-token-code-verifier'
      const parsed = parse(rawCookie)
      log(`parse() keys: ${Object.keys(parsed).join(', ')}`)

      // Also try manual extraction as fallback
      let verifierValue: string | null = null
      const parts = rawCookie.split(';').map(c => c.trim())
      for (const part of parts) {
        if (part.startsWith(verifierCookieName + '=')) {
          verifierValue = part.substring(verifierCookieName.length + 1)
          break
        }
      }

      if (parsed[verifierCookieName]) {
        log(`parse() found verifier: ${parsed[verifierCookieName].substring(0, 40)}...`)
        verifierValue = parsed[verifierCookieName]
      } else if (verifierValue) {
        log(`Manual extract found verifier: ${verifierValue.substring(0, 40)}...`)
      } else {
        log('ERROR: No code-verifier in cookies at all!')
        return
      }

      // Decode the base64 verifier value
      // The value is stored as: base64-<base64url encoded JSON string>
      // The JSON string is: "<hex_verifier>/<redirect_type>"
      let codeVerifier = verifierValue
      if (codeVerifier.startsWith('base64-')) {
        try {
          const b64 = codeVerifier.substring(7) // remove "base64-" prefix
          // base64url to base64
          const b64std = b64.replace(/-/g, '+').replace(/_/g, '/')
          const decoded = atob(b64std)
          log(`Decoded verifier: ${decoded.substring(0, 50)}...`)
          // It's a JSON string like "\"hexvalue/redirect\""
          codeVerifier = JSON.parse(decoded)
          log(`JSON parsed verifier: ${String(codeVerifier).substring(0, 50)}...`)
        } catch (e) {
          log(`Decode error: ${e}`)
        }
      }

      // Split off redirect type if present
      const [actualVerifier] = String(codeVerifier).split('/')
      log(`Final verifier: ${actualVerifier.substring(0, 20)}...`)

      // Now call the Supabase token endpoint directly
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

      log(`Supabase URL: ${supabaseUrl}`)
      log(`Anon key starts: ${anonKey?.substring(0, 20)}...`)
      log(`Anon key length: ${anonKey?.length}`)
      log('Calling token endpoint directly...')
      try {
        const tokenUrl = `${supabaseUrl}/auth/v1/token?grant_type=pkce`
        log(`Token URL: ${tokenUrl}`)
        const res = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
          },
          body: JSON.stringify({
            auth_code: code,
            code_verifier: actualVerifier,
          }),
        })

        const data = await res.json()
        log(`Token response status: ${res.status}`)

        if (!res.ok) {
          log(`Token error: ${JSON.stringify(data)}`)
          return
        }

        log(`Success! User: ${data.user?.email}`)

        // Now use the Supabase client to save the session properly
        const supabase = createBrowserClient(
          supabaseUrl,
          anonKey,
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

        // Set session manually
        const { error: setError } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })

        if (setError) {
          log(`setSession error: ${setError.message}`)
          return
        }

        // Clean up the code-verifier cookie
        document.cookie = `${verifierCookieName}=; path=/; domain=.wins.im; max-age=0`

        log('Session saved! Redirecting...')
        setTimeout(() => router.replace('/dashboard'), 1500)
      } catch (e) {
        log(`Fetch error: ${e}`)
      }
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
