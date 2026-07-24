import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getClaims, redirect } = vi.hoisted(() => ({
  getClaims: vi.fn(),
  redirect: vi.fn((url) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/supabase/server.js', () => ({
  createClient: vi.fn(async () => ({ auth: { getClaims } })),
}))
vi.mock('next/navigation', () => ({ redirect }))

import Home from './page'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the root route', () => {
  it('takes a signed-in learner straight to their dashboard', async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: 'user-1' } }, error: null })

    await expect(Home()).rejects.toThrow('NEXT_REDIRECT:/dashboard')
  })

  it('sends a signed-out visitor to sign in', async () => {
    getClaims.mockResolvedValue({ data: null, error: null })

    await expect(Home()).rejects.toThrow('NEXT_REDIRECT:/sign-in')
  })

  it('renders nothing of its own — it is a junction, not a page', async () => {
    getClaims.mockResolvedValue({ data: null, error: null })

    await expect(Home()).rejects.toThrow()
    expect(redirect).toHaveBeenCalledTimes(1)
  })
})
