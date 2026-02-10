import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    console.log('[CALLBACK DEBUG] All cookies received:', allCookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`))
    console.log('[CALLBACK DEBUG] Cookie names:', allCookies.map(c => c.name))
    const hasVerifier = allCookies.some(c => c.name.includes('code-verifier'))
    console.log('[CALLBACK DEBUG] Has code-verifier cookie:', hasVerifier)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Ignore - cookies can't be set in some contexts
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    console.log('[CALLBACK DEBUG] exchangeCodeForSession result:', error ? error.message : 'SUCCESS')
    if (!error) {
      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
    console.error('Auth callback error:', error.message)
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.wins.im'
  return NextResponse.redirect(`${siteUrl}/auth?error=auth_failed`)
}
