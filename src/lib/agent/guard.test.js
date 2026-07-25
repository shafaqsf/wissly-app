// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { assertLearnerClient, isPrivilegedClient } from './guard.js'

/* The single most important file in the suite.
 *
 * The agent reads uploaded PDFs, which is to say attacker-controlled input, by
 * design. It must reach the database through the learner's own session so that
 * row level security bounds what a prompt injection can do to *that learner's*
 * account. A privileged client bypasses row level security entirely and would
 * turn a poisoned lecture handout into everybody's data.
 *
 * The old assertion was a grep over the source. That catches the mistake
 * spelled one way. This catches the client itself, whatever it was called on
 * the way in. */

/** The publishable key the browser also holds. This one is fine. */
const learner = { supabaseKey: 'sb_publishable_abc123' }

const privileged = [
  ['the new-style secret key', { supabaseKey: 'sb_secret_abc123' }],
  [
    'a legacy service_role JWT',
    {
      supabaseKey: [
        'eyJhbGciOiJIUzI1NiJ9',
        Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url'),
        'signature',
      ].join('.'),
    },
  ],
  [
    'a key hidden in the rest headers rather than on the client',
    { rest: { headers: { apikey: 'sb_secret_abc123' } } },
  ],
  [
    'a key hidden in an Authorization header',
    { headers: { Authorization: 'Bearer sb_secret_abc123' } },
  ],
]

describe('isPrivilegedClient', () => {
  it.each(privileged)('sees through %s', (_name, client) => {
    expect(isPrivilegedClient(client)).toBe(true)
  })

  it('leaves the learner’s own client alone', () => {
    expect(isPrivilegedClient(learner)).toBe(false)
  })

  it('leaves a client that names no key at all alone, as the test fakes do', () => {
    expect(isPrivilegedClient({ from: () => {} })).toBe(false)
    expect(isPrivilegedClient(null)).toBe(false)
  })
})

describe('assertLearnerClient', () => {
  it.each(privileged)('refuses to act with %s', (_name, client) => {
    expect(() => assertLearnerClient(client)).toThrow(/as the learner/i)
  })

  it('lets the learner’s own client through', () => {
    expect(() => assertLearnerClient(learner)).not.toThrow()
  })
})
