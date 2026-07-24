// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getClaims = vi.fn()
const createServerClient = vi.fn(() => ({ auth: { getClaims } }))
vi.mock('@supabase/ssr', () => ({ createServerClient }))

beforeEach(() => {
  vi.resetModules()
  getClaims.mockReset()
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test')
})

function signedIn() {
  getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })
}

function signedOut() {
  getClaims.mockResolvedValue({ data: null, error: null })
}

async function run(path) {
  const { proxy } = await import('./proxy.js')
  return proxy(new NextRequest(new URL(path, 'http://localhost:3000')))
}

describe('the proxy', () => {
  it('sends a signed-out visitor from the dashboard to sign in', async () => {
    signedOut()

    const response = await run('/dashboard')

    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location'))
    expect(location.pathname).toBe('/sign-in')
  })

  it('remembers where the signed-out visitor was going', async () => {
    signedOut()

    const response = await run('/dashboard/subjects')

    const location = new URL(response.headers.get('location'))
    expect(location.searchParams.get('next')).toBe('/dashboard/subjects')
  })

  it('lets a signed-in learner through to the dashboard', async () => {
    signedIn()

    const response = await run('/dashboard')

    expect(response.headers.get('location')).toBeNull()
  })

  it.each(['/review', '/progress', '/library', '/courses', '/settings'])(
    'guards %s, which sits in the dashboard frame and holds a learner\'s work',
    async (path) => {
      signedOut()

      const response = await run(path)

      expect(response.status).toBe(307)
      const location = new URL(response.headers.get('location'))
      expect(location.pathname).toBe('/sign-in')
      expect(location.searchParams.get('next')).toBe(path)
    },
  )

  it('leaves the root junction to decide for itself', async () => {
    signedOut()

    const response = await run('/')

    expect(response.headers.get('location')).toBeNull()
  })

  it('sends a signed-in learner away from the sign-in screen', async () => {
    signedIn()

    const response = await run('/sign-in')

    const location = new URL(response.headers.get('location'))
    expect(location.pathname).toBe('/dashboard')
  })

  it('leaves the sign-in screen open to a signed-out visitor', async () => {
    signedOut()

    const response = await run('/sign-in')

    expect(response.headers.get('location')).toBeNull()
  })
})
