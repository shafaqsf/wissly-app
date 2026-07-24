import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { requireEnv } from './env.js'

/**
 * A Supabase client for server components, server actions and route
 * handlers. The session travels in cookies, so the client is built per
 * request and must never be hoisted into a module-level constant.
 *
 * This uses the publishable key, not the secret one: server code should be
 * subject to the same row level security as the browser. The secret key
 * bypasses RLS entirely and belongs only in a deliberate admin path.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // A server component cannot write cookies. The refresh still
            // happened in the proxy, which can, so there is nothing to fix
            // here and nothing to report.
          }
        },
      },
    },
  )
}
