// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ConsoleEmailSender, defaultEmailSender } from './email-sender.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ConsoleEmailSender', () => {
  it('never claims to have delivered anything', async () => {
    const sender = new ConsoleEmailSender()
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await sender.send({
      to: 'learner@example.com',
      subject: 'Your week',
      text: 'You did 12 reviews.',
    })

    expect(result).toEqual({ delivered: false, id: null })
  })

  it('writes what would have been sent where a developer can see it', async () => {
    const sender = new ConsoleEmailSender()
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await sender.send({ to: 'learner@example.com', subject: 'Your week', text: 'You did 12 reviews.' })

    expect(log).toHaveBeenCalledTimes(1)
    const [line] = log.mock.calls[0]
    expect(line).toContain('learner@example.com')
    expect(line).toContain('Your week')
  })

  it('sends nothing over the network — no fetch, no provider client', async () => {
    const sender = new ConsoleEmailSender()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('should never be called')
    })

    await sender.send({ to: 'learner@example.com', subject: 'Your week', text: 'body' })

    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})

describe('defaultEmailSender', () => {
  it('is the console stub, until a real provider is wired up in this one place', () => {
    expect(defaultEmailSender()).toBeInstanceOf(ConsoleEmailSender)
  })
})
