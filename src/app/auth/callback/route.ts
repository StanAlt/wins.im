import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.wins.im'

  // Log all cookies for debugging
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  console.log('Auth callback - cookies present:', allCookies.map(c => c.name))
  console.log('Auth callback - code present:', !!code)
  console.log('Auth callback - SUPABASE_URL set:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)

  if (code) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        console.log('Auth callback - session exchanged successfully for:', data.user?.email)
        return NextResponse.redirect(`${siteUrl}${next}`)
      }
      console.error('Auth callback error:', error.message, 'status:', error.status)
    } catch (e) {
      console.error('Auth callback exception:', e)
    }
  }

  return NextResponse.redirect(`${siteUrl}/auth?error=auth_failed`)
}
