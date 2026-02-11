'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function AuthCallbackPage() {
  const router = useRouter()
  const processed = useRef(false)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')

      if (!code) {
        router.replace('/auth?error=no_code')
        return
      }

      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        console.error('Auth callback error:', error.message)
        router.replace('/auth?error=auth_failed')
        return
      }

      router.replace('/dashboard')
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
      <div className="text-white/60 text-sm">Signing you in...</div>
    </div>
  )
}
