import { beforeEach, describe, expect, it, vi } from 'vitest'

const createBrowserClient = vi.fn(() => ({ browser: true }))
vi.mock('@supabase/ssr', () => ({ createBrowserClient }))

beforeEach(() => {
  vi.resetModules()
  createBrowserClient.mockClear()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
})

describe('the browser client', () => {
  it('is built from the two public environment variables', async () => {
    const { createClient } = await import('./client.js')

    createClient()

    expect(createBrowserClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'sb_publishable_test',
    )
  })

  it('never reaches for the secret key', async () => {
    const { readFileSync } = await import('node:fs')
    const source = readFileSync('src/lib/supabase/client.js', 'utf8')

    expect(source).not.toContain('SUPABASE_SECRET_KEY')
  })

  it('says which variable is missing rather than failing at the first request', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
    const { createClient } = await import('./client.js')

    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/)
  })
})
