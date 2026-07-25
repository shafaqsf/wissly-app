// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/server.js', () => ({
  createClient: vi.fn(async () => ({ cookieSession: true })),
}))

vi.mock('@/lib/auth/user.js', () => ({
  currentUserId: vi.fn(async () => null),
}))

vi.mock('@/lib/agent/standing-orders.js', () => ({
  runDueStandingOrders: vi.fn(async () => ({ due: 2, ran: [{ standing_order_id: 'o1' }] })),
}))

const refreshSession = vi.fn(async () => ({
  data: { user: { id: 'u7' }, session: { access_token: 'a' } },
  error: null,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ tokenSession: true, auth: { refreshSession } })),
}))

const { currentUserId } = await import('@/lib/auth/user.js')
const { runDueStandingOrders } = await import('@/lib/agent/standing-orders.js')
const { createClient: createTokenClient } = await import('@supabase/supabase-js')

const { POST, runtime } = await import('./route.js')

const SECRET = 'a-long-shared-secret-value'

function tick({ secret = SECRET, body = {} } = {}) {
  const headers = { 'content-type': 'application/json' }
  if (secret !== null) headers.authorization = `Bearer ${secret}`

  return new Request('http://localhost/api/cron/standing-orders', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

const ENV = { ...process.env }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = SECRET
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
  currentUserId.mockResolvedValue(null)
  refreshSession.mockResolvedValue({
    data: { user: { id: 'u7' }, session: { access_token: 'a' } },
    error: null,
  })
  runDueStandingOrders.mockResolvedValue({ due: 2, ran: [{ standing_order_id: 'o1' }] })
})

afterEach(() => {
  process.env = { ...ENV }
})

describe('the trigger', () => {
  it('runs on Node, because the agent SDK needs it', () => {
    expect(runtime).toBe('nodejs')
  })

  it('refuses to run at all when no secret is configured', async () => {
    delete process.env.CRON_SECRET

    const response = await POST(tick())

    expect(response.status).toBe(503)
    expect(runDueStandingOrders).not.toHaveBeenCalled()
  })

  it('refuses a caller with no secret', async () => {
    const response = await POST(tick({ secret: null }))

    expect(response.status).toBe(401)
    expect(runDueStandingOrders).not.toHaveBeenCalled()
  })

  it('refuses a caller with the wrong secret', async () => {
    const response = await POST(tick({ secret: 'not-the-shared-secret-value' }))

    expect(response.status).toBe(401)
    expect(runDueStandingOrders).not.toHaveBeenCalled()
  })

  it('refuses a secret of the right value but the wrong length', async () => {
    const response = await POST(tick({ secret: `${SECRET}x` }))

    expect(response.status).toBe(401)
  })

  it('acts as the learner named by a refresh token', async () => {
    const response = await POST(tick({ body: { refreshToken: 'rt-1' } }))

    expect(response.status).toBe(200)
    expect(refreshSession).toHaveBeenCalledWith({ refresh_token: 'rt-1' })

    const [, key] = createTokenClient.mock.calls[0]
    expect(key).toBe('sb_publishable_test')

    expect(runDueStandingOrders).toHaveBeenCalledWith(
      expect.objectContaining({ supabase: expect.objectContaining({ tokenSession: true }), userId: 'u7', limit: 1 }),
    )
    expect(await response.json()).toMatchObject({ due: 2 })
  })

  it('refuses a refresh token the project will not exchange', async () => {
    refreshSession.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } })

    const response = await POST(tick({ body: { refreshToken: 'rt-1' } }))

    expect(response.status).toBe(401)
    expect(runDueStandingOrders).not.toHaveBeenCalled()
  })

  it('falls back to the session in the request when no token was handed over', async () => {
    currentUserId.mockResolvedValue('u1')

    const response = await POST(tick())

    expect(response.status).toBe(200)
    expect(runDueStandingOrders).toHaveBeenCalledWith(
      expect.objectContaining({ supabase: { cookieSession: true }, userId: 'u1' }),
    )
  })

  it('refuses when neither a token nor a session names a learner', async () => {
    const response = await POST(tick())

    expect(response.status).toBe(401)
    expect(runDueStandingOrders).not.toHaveBeenCalled()
  })

  it('runs one order a tick unless told otherwise', async () => {
    currentUserId.mockResolvedValue('u1')

    await POST(tick({ body: { limit: 3 } }))

    expect(runDueStandingOrders).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }))
  })

  it('reports a tick that fell over rather than throwing', async () => {
    currentUserId.mockResolvedValue('u1')
    runDueStandingOrders.mockRejectedValue(new Error('the orders could not be read'))

    const response = await POST(tick())

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('could not be read'),
    })
  })
})
