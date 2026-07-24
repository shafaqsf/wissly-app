import { createBrowserClient } from '@supabase/ssr'

import { requireEnv } from './env.js'

/**
 * A Supabase client for client components.
 *
 * The publishable key is meant to reach the browser; row level security is
 * what protects the rows behind it. The secret key must never appear in this
 * file or anything it imports.
 */
export function createClient() {
  return createBrowserClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
  )
}
