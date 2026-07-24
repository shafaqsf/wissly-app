// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  OpenRouterError,
  createOpenRouterClient,
  openRouterConfigFromEnv,
} from './openrouter.js'

const env = {
  OPENROUTER_API_KEY: 'sk-test',
  OPENROUTER_MODEL: 'anthropic/claude-opus-5',
  OPENROUTER_SITE_URL: 'https://wissly.test',
  OPENROUTER_SITE_NAME: 'wissly',
}

/** A response the way `fetch` hands it back. */
function reply(body, { status = 200, headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  }
}

const completion = (content) =>
  reply({
    id: 'gen-1',
    model: 'anthropic/claude-opus-5',
    choices: [{ message: { role: 'assistant', content }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
  })

/** No test may sleep for real; backoff is observed, not waited out. */
function clientWith(fetchImpl, options = {}) {
  const slept = []
  const client = createOpenRouterClient({
    ...env,
    fetch: fetchImpl,
    sleep: async (ms) => {
      slept.push(ms)
    },
    random: () => 0.5,
    ...options,
  })
  return { client, slept }
}

let fetchMock

beforeEach(() => {
  fetchMock = vi.fn()
})

describe('openRouterConfigFromEnv', () => {
  it('reads the four documented variables', () => {
    expect(openRouterConfigFromEnv(env)).toEqual({
      apiKey: 'sk-test',
      model: 'anthropic/claude-opus-5',
      siteUrl: 'https://wissly.test',
      siteName: 'wissly',
    })
  })

  it('refuses to run without an API key', () => {
    expect(() => openRouterConfigFromEnv({ ...env, OPENROUTER_API_KEY: '' })).toThrow(
      /OPENROUTER_API_KEY/,
    )
  })

  it('refuses to run without a model, since there is no safe default cost', () => {
    expect(() => openRouterConfigFromEnv({ ...env, OPENROUTER_MODEL: '' })).toThrow(
      /OPENROUTER_MODEL/,
    )
  })

  it('tolerates missing attribution, which is optional to OpenRouter', () => {
    const config = openRouterConfigFromEnv({
      OPENROUTER_API_KEY: 'sk-test',
      OPENROUTER_MODEL: 'm',
    })
    expect(config.siteUrl).toBe(undefined)
    expect(config.siteName).toBe(undefined)
  })
})

describe('chat', () => {
  it('posts to the chat completions endpoint with the configured model', async () => {
    fetchMock.mockResolvedValue(completion('Hello.'))
    const { client } = clientWith(fetchMock)

    await client.chat({ messages: [{ role: 'user', content: 'Hi' }] })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'anthropic/claude-opus-5',
      messages: [{ role: 'user', content: 'Hi' }],
    })
  })

  it('sends the key as a bearer token and the attribution headers', async () => {
    fetchMock.mockResolvedValue(completion('Hello.'))
    const { client } = clientWith(fetchMock)

    await client.chat({ messages: [{ role: 'user', content: 'Hi' }] })

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Authorization: 'Bearer sk-test',
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://wissly.test',
      'X-Title': 'wissly',
    })
  })

  it('omits the attribution headers when they are not configured', async () => {
    fetchMock.mockResolvedValue(completion('Hello.'))
    const { client } = clientWith(fetchMock, {
      OPENROUTER_SITE_URL: undefined,
      OPENROUTER_SITE_NAME: undefined,
    })

    await client.chat({ messages: [{ role: 'user', content: 'Hi' }] })

    const { headers } = fetchMock.mock.calls[0][1]
    expect(headers).not.toHaveProperty('HTTP-Referer')
    expect(headers).not.toHaveProperty('X-Title')
  })

  it('lets the caller override the model per request', async () => {
    fetchMock.mockResolvedValue(completion('Hello.'))
    const { client } = clientWith(fetchMock)

    await client.chat({ messages: [], model: 'anthropic/claude-sonnet-5' })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(
      'anthropic/claude-sonnet-5',
    )
  })

  it('passes temperature, max tokens and an abort signal through', async () => {
    fetchMock.mockResolvedValue(completion('Hello.'))
    const { client } = clientWith(fetchMock)
    const controller = new AbortController()

    await client.chat({
      messages: [],
      temperature: 0.2,
      maxTokens: 512,
      signal: controller.signal,
    })

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toMatchObject({
      temperature: 0.2,
      max_tokens: 512,
    })
    expect(init.signal).toBe(controller.signal)
  })

  it('returns the assistant text, the model that answered and the usage', async () => {
    fetchMock.mockResolvedValue(completion('Hello.'))
    const { client } = clientWith(fetchMock)

    const result = await client.chat({ messages: [] })

    expect(result.content).toBe('Hello.')
    expect(result.model).toBe('anthropic/claude-opus-5')
    expect(result.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 4,
      total_tokens: 14,
    })
    expect(result.finishReason).toBe('stop')
  })

  it('fails clearly when the body is not JSON at all', async () => {
    fetchMock.mockResolvedValue(reply('<html>gateway</html>'))
    const { client } = clientWith(fetchMock)

    await expect(client.chat({ messages: [] })).rejects.toThrow(
      /OpenRouter returned a body that is not JSON/,
    )
  })

  it('fails clearly when the response carries no choice', async () => {
    fetchMock.mockResolvedValue(reply({ choices: [] }))
    const { client } = clientWith(fetchMock)

    await expect(client.chat({ messages: [] })).rejects.toThrow(
      /OpenRouter returned no choices/,
    )
  })
})

describe('chat — retries', () => {
  it('retries a 429 and succeeds on the next attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({ error: { message: 'slow down' } }, { status: 429 }))
      .mockResolvedValueOnce(completion('Hello.'))
    const { client, slept } = clientWith(fetchMock)

    const result = await client.chat({ messages: [] })

    expect(result.content).toBe('Hello.')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(slept).toHaveLength(1)
  })

  it('retries a 500 and a 503', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({}, { status: 500 }))
      .mockResolvedValueOnce(reply({}, { status: 503 }))
      .mockResolvedValueOnce(completion('Hello.'))
    const { client } = clientWith(fetchMock, { maxAttempts: 3 })

    await expect(client.chat({ messages: [] })).resolves.toMatchObject({
      content: 'Hello.',
    })
  })

  it('retries a network failure', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(completion('Hello.'))
    const { client } = clientWith(fetchMock)

    await expect(client.chat({ messages: [] })).resolves.toMatchObject({
      content: 'Hello.',
    })
  })

  it('backs off exponentially between attempts', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({}, { status: 500 }))
      .mockResolvedValueOnce(reply({}, { status: 500 }))
      .mockResolvedValueOnce(completion('Hello.'))
    const { client, slept } = clientWith(fetchMock, { maxAttempts: 3, baseDelayMs: 100 })

    await client.chat({ messages: [] })

    // 100 then 200, each with the jitter our stubbed random pins to the middle.
    expect(slept).toEqual([100, 200])
  })

  it('obeys a Retry-After header in preference to its own backoff', async () => {
    fetchMock
      .mockResolvedValueOnce(reply({}, { status: 429, headers: { 'retry-after': '3' } }))
      .mockResolvedValueOnce(completion('Hello.'))
    const { client, slept } = clientWith(fetchMock, { baseDelayMs: 100 })

    await client.chat({ messages: [] })

    expect(slept).toEqual([3000])
  })

  it('gives up after the bounded number of attempts', async () => {
    fetchMock.mockResolvedValue(reply({ error: { message: 'overloaded' } }, { status: 503 }))
    const { client } = clientWith(fetchMock, { maxAttempts: 3 })

    await expect(client.chat({ messages: [] })).rejects.toThrow(
      /OpenRouter request failed after 3 attempts: 503 overloaded/,
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry a 400, which will fail identically every time', async () => {
    fetchMock.mockResolvedValue(
      reply({ error: { message: 'bad model' } }, { status: 400 }),
    )
    const { client } = clientWith(fetchMock)

    await expect(client.chat({ messages: [] })).rejects.toThrow(/400 bad model/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a 401, and says so plainly', async () => {
    fetchMock.mockResolvedValue(reply({ error: { message: 'no key' } }, { status: 401 }))
    const { client } = clientWith(fetchMock)

    await expect(client.chat({ messages: [] })).rejects.toThrow(/401 no key/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('surfaces the status on the error, so callers can branch on it', async () => {
    fetchMock.mockResolvedValue(reply({ error: { message: 'nope' } }, { status: 402 }))
    const { client } = clientWith(fetchMock)

    const error = await client.chat({ messages: [] }).catch((caught) => caught)
    expect(error).toBeInstanceOf(OpenRouterError)
    expect(error.status).toBe(402)
    expect(error.attempts).toBe(1)
  })

  it('never retries after an abort', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    fetchMock.mockRejectedValue(abort)
    const { client } = clientWith(fetchMock)

    await expect(client.chat({ messages: [] })).rejects.toThrow('aborted')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('chatStructured', () => {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['front', 'back'],
    properties: { front: { type: 'string' }, back: { type: 'string' } },
  }

  it('asks the provider for JSON matching the schema', async () => {
    fetchMock.mockResolvedValue(completion('{"front":"a","back":"b"}'))
    const { client } = clientWith(fetchMock)

    await client.chatStructured({ messages: [], schema, schemaName: 'flashcard' })

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'flashcard', strict: true, schema },
    })
  })

  it('returns the parsed and validated object', async () => {
    fetchMock.mockResolvedValue(completion('{"front":"a","back":"b"}'))
    const { client } = clientWith(fetchMock)

    await expect(
      client.chatStructured({ messages: [], schema, schemaName: 'flashcard' }),
    ).resolves.toEqual({ front: 'a', back: 'b' })
  })

  it('digs the object out of a fenced code block, which models still emit', async () => {
    fetchMock.mockResolvedValue(
      completion('Sure!\n```json\n{"front":"a","back":"b"}\n```\n'),
    )
    const { client } = clientWith(fetchMock)

    await expect(
      client.chatStructured({ messages: [], schema, schemaName: 'flashcard' }),
    ).resolves.toEqual({ front: 'a', back: 'b' })
  })

  it('retries once when the object does not match the schema', async () => {
    fetchMock
      .mockResolvedValueOnce(completion('{"front":"a"}'))
      .mockResolvedValueOnce(completion('{"front":"a","back":"b"}'))
    const { client } = clientWith(fetchMock)

    await expect(
      client.chatStructured({ messages: [], schema, schemaName: 'flashcard' }),
    ).resolves.toEqual({ front: 'a', back: 'b' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('tells the model on the retry exactly what was wrong', async () => {
    fetchMock
      .mockResolvedValueOnce(completion('{"front":"a"}'))
      .mockResolvedValueOnce(completion('{"front":"a","back":"b"}'))
    const { client } = clientWith(fetchMock)

    await client.chatStructured({ messages: [], schema, schemaName: 'flashcard' })

    const retry = JSON.parse(fetchMock.mock.calls[1][1].body).messages
    expect(retry.at(-1).role).toBe('user')
    expect(retry.at(-1).content).toMatch(/missing required property "back"/)
    expect(retry.at(-2)).toEqual({ role: 'assistant', content: '{"front":"a"}' })
  })

  it('retries once when the answer is not JSON at all', async () => {
    fetchMock
      .mockResolvedValueOnce(completion('I am afraid I cannot do that.'))
      .mockResolvedValueOnce(completion('{"front":"a","back":"b"}'))
    const { client } = clientWith(fetchMock)

    await expect(
      client.chatStructured({ messages: [], schema, schemaName: 'flashcard' }),
    ).resolves.toEqual({ front: 'a', back: 'b' })
  })

  it('gives up after one repair attempt and reports the validation errors', async () => {
    fetchMock.mockResolvedValue(completion('{"front":"a"}'))
    const { client } = clientWith(fetchMock)

    const error = await client
      .chatStructured({ messages: [], schema, schemaName: 'flashcard' })
      .catch((caught) => caught)

    expect(error).toBeInstanceOf(OpenRouterError)
    expect(error.message).toMatch(
      /flashcard did not match its schema after 2 attempts/,
    )
    expect(error.validationErrors).toEqual([': missing required property "back"'])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not swallow a transport failure as a schema failure', async () => {
    fetchMock.mockResolvedValue(reply({ error: { message: 'no key' } }, { status: 401 }))
    const { client } = clientWith(fetchMock)

    await expect(
      client.chatStructured({ messages: [], schema, schemaName: 'flashcard' }),
    ).rejects.toThrow(/401 no key/)
  })
})
