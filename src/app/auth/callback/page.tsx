'use client'

import { createBrowserClient } from '@supabase/ssr'
import { parse } from 'cookie'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const handleCallback = async () => {
      const code = new URLSearchParams(window.location.search).get('code')
      if (!code) {
        router.replace('/auth?error=no_code')
        return
      }

      // Read code-verifier directly from document.cookie before creating any
      // Supabase client. The client's initialize() can race and consume it.
      const rawCookie = document.cookie
      const verifierCookieName = 'sb-pzxaidqhlwlluyiqydqz-auth-token-code-verifier'
      const parsed = parse(rawCookie)

      // Try parse() first, fall back to manual extraction
      let verifierValue: string | null = parsed[verifierCookieName] ?? null
      if (!verifierValue) {
        const parts = rawCookie.split(';').map(c => c.trim())
        for (const part of parts) {
          if (part.startsWith(verifierCookieName + '=')) {
            verifierValue = part.substring(verifierCookieName.length + 1)
            break
          }
        }
      }

      if (!verifierValue) {
        router.replace('/auth?error=no_verifier')
        return
      }

      // Decode the base64url-encoded verifier
      let codeVerifier = verifierValue
      if (codeVerifier.startsWith('base64-')) {
        try {
          const b64 = codeVerifier.substring(7)
          const b64std = b64.replace(/-/g, '+').replace(/_/g, '/')
          const decoded = atob(b64std)
          codeVerifier = JSON.parse(decoded)
        } catch {
          router.replace('/auth?error=decode_failed')
          return
        }
      }

      // Split off redirect type if present (format: "verifier/redirectType")
      const [actualVerifier] = String(codeVerifier).split('/')

      // Exchange code for session via Supabase token endpoint directly
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

      try {
        const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=pkce`, {
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

        if (!res.ok) {
          console.error('Token exchange failed:', data)
          router.replace('/auth?error=exchange_failed')
          return
        }

        // Save session via Supabase client
        const supabase = createBrowserClient(supabaseUrl, anonKey, {
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
        })

        const { error } = await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        })

        if (error) {
          console.error('setSession failed:', error)
          router.replace('/auth?error=session_failed')
          return
        }

        // Clean up the code-verifier cookie
        document.cookie = `${verifierCookieName}=; path=/; domain=.wins.im; max-age=0`

        router.replace('/dashboard')
      } catch (e) {
        console.error('Auth callback error:', e)
        router.replace('/auth?error=unexpected')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
      <div className="text-white/60 text-sm">Signing you in...</div>
    </div>
  )
}
