import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function createClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    // During SSR/prerendering — return a no-op stub.
    // Client components only use Supabase in useEffect/event handlers.
    return {} as SupabaseClient
  }
  if (!cached) {
    cached = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return cached
}
