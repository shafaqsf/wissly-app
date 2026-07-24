// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const createServerClient = vi.fn(() => ({ server: true }))
vi.mock('@supabase/ssr', () => ({ createServerClient }))

const cookieStore = {
  getAll: vi.fn(() => [{ name: 'sb-access-token', value: 'abc' }]),
  set: vi.fn(),
}
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }))

beforeEach(() => {
  vi.resetModules()
  createServerClient.mockClear()
  cookieStore.set.mockClear()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
})

/** The cookie adapter handed to `createServerClient` on the last call. */
function lastCookieAdapter() {
  return createServerClient.mock.calls.at(-1)[2].cookies
}

describe('the server client', () => {
  it('is built from the two public environment variables', async () => {
    const { createClient } = await import('./server.js')

    await createClient()

    expect(createServerClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_publishable_test',
      expect.anything(),
    )
  })

  it('never reaches for the secret key', async () => {
    const { readFileSync } = await import('node:fs')

    expect(readFileSync('src/lib/supabase/server.js', 'utf8')).not.toContain(
      'SUPABASE_SECRET_KEY',
    )
  })

  it('reads the session out of the request cookies', async () => {
    const { createClient } = await import('./server.js')
    await createClient()

    expect(lastCookieAdapter().getAll()).toEqual([
      { name: 'sb-access-token', value: 'abc' },
    ])
  })

  it('writes refreshed tokens back to the cookie store', async () => {
    const { createClient } = await import('./server.js')
    await createClient()

    lastCookieAdapter().setAll([
      { name: 'sb-access-token', value: 'fresh', options: { path: '/' } },
    ])

    expect(cookieStore.set).toHaveBeenCalledWith('sb-access-token', 'fresh', {
      path: '/',
    })
  })

  it('tolerates a read-only cookie store, which server components have', async () => {
    cookieStore.set.mockImplementation(() => {
      throw new Error('Cookies can only be modified in a Server Action')
    })
    const { createClient } = await import('./server.js')
    await createClient()

    expect(() =>
      lastCookieAdapter().setAll([{ name: 'a', value: 'b', options: {} }]),
    ).not.toThrow()

    cookieStore.set.mockImplementation(() => {})
  })
})
