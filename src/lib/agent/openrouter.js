import 'server-only'

import { validate } from './schema.js'

/**
 * OpenRouter chat completions.
 *
 * Server only. `OPENROUTER_API_KEY` is a bearer token with a spend limit
 * attached to it: importing this module into a client component would ship the
 * key to every visitor, so the `server-only` import above turns that mistake
 * into a build error rather than a bill.
 *
 * Two entry points:
 *
 * - `chat` — free text back, with bounded retries on the failures that are
 *   worth retrying (429, 5xx, transport).
 * - `chatStructured` — a JSON schema in, a validated object out. The schema is
 *   sent to the provider *and* enforced here, and a mismatch buys the model
 *   exactly one repair attempt with the validation errors quoted back at it.
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504])

export class OpenRouterError extends Error {
  /**
   * @param {string} message
   * @param {{status?: number, attempts?: number, cause?: unknown,
   *   validationErrors?: string[], body?: string}} [details]
   */
  constructor(message, details = {}) {
    super(message, { cause: details.cause })
    this.name = 'OpenRouterError'
    this.status = details.status
    this.attempts = details.attempts
    this.validationErrors = details.validationErrors
    this.body = details.body
  }
}

/**
 * Read the documented env contract. Called with `process.env` in production and
 * with a plain object in tests, because a module that reaches for a global is a
 * module you cannot test twice with different settings.
 *
 * @param {Record<string, string|undefined>} [env]
 * @returns {{apiKey: string, model: string, siteUrl?: string, siteName?: string}}
 */
export function openRouterConfigFromEnv(env = process.env) {
  const apiKey = env.OPENROUTER_API_KEY
  const model = env.OPENROUTER_MODEL
  if (!apiKey) {
    throw new OpenRouterError(
      'OPENROUTER_API_KEY is not set. Copy .env.example to .env.local and fill it in.',
    )
  }
  if (!model) {
    throw new OpenRouterError(
      'OPENROUTER_MODEL is not set. There is no safe default: the model decides the cost.',
    )
  }
  return {
    apiKey,
    model,
    siteUrl: env.OPENROUTER_SITE_URL || undefined,
    siteName: env.OPENROUTER_SITE_NAME || undefined,
  }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function isAbort(error) {
  return error?.name === 'AbortError'
}

function errorMessageFrom(body, status) {
  try {
    const parsed = JSON.parse(body)
    return parsed?.error?.message ?? parsed?.message ?? `HTTP ${status}`
  } catch {
    return body?.trim()?.slice(0, 200) || `HTTP ${status}`
  }
}

function retryAfterMs(response) {
  const header = response.headers?.get?.('retry-after')
  if (!header) return null
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(seconds, 0) * 1000
  const date = Date.parse(header)
  return Number.isNaN(date) ? null : Math.max(date - Date.now(), 0)
}

/**
 * Pull the first JSON object or array out of a model answer. Providers that do
 * not honour `response_format` still tend to wrap the object in prose or a
 * fenced code block, and throwing that away would mean paying for the call
 * twice for no reason.
 *
 * @param {string} text
 * @returns {unknown}
 */
export function parseJsonAnswer(text) {
  const trimmed = (text ?? '').trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = [fenced?.[1], trimmed].filter(Boolean)
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim())
    } catch {
      const start = candidate.search(/[[{]/)
      const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'))
      if (start === -1 || end <= start) continue
      try {
        return JSON.parse(candidate.slice(start, end + 1))
      } catch {
        /* fall through to the next candidate */
      }
    }
  }
  throw new OpenRouterError(
    `the model did not return JSON: ${trimmed.slice(0, 200)}`,
  )
}

/**
 * @param {object} [options]
 * @param {string} [options.apiKey]
 * @param {string} [options.model]
 * @param {string} [options.siteUrl]
 * @param {string} [options.siteName]
 * @param {number} [options.maxAttempts=4] bound on attempts per request
 * @param {number} [options.baseDelayMs=500] first backoff step
 * @param {number} [options.maxDelayMs=20000] backoff ceiling
 * @param {typeof fetch} [options.fetch]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {() => number} [options.random] jitter source
 */
export function createOpenRouterClient(options = {}) {
  const {
    maxAttempts = 4,
    baseDelayMs = 500,
    maxDelayMs = 20000,
    fetch: fetchImpl = globalThis.fetch,
    sleep = wait,
    random = Math.random,
  } = options

  const config =
    options.apiKey && options.model
      ? {
          apiKey: options.apiKey,
          model: options.model,
          siteUrl: options.siteUrl,
          siteName: options.siteName,
        }
      : openRouterConfigFromEnv({ ...process.env, ...options })

  if (typeof fetchImpl !== 'function') {
    throw new OpenRouterError('no fetch implementation available')
  }

  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
    ...(config.siteUrl ? { 'HTTP-Referer': config.siteUrl } : {}),
    ...(config.siteName ? { 'X-Title': config.siteName } : {}),
  }

  /**
   * Exponential backoff with jitter: the delay doubles each attempt and is
   * then scattered over 0.5x..1.5x of that, so that a burst of requests that
   * all hit the same rate limit does not come back in lockstep.
   */
  function backoffMs(attempt) {
    const step = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
    return Math.round(step * (0.5 + random()))
  }

  async function request(body, signal) {
    let lastError

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response
      try {
        response = await fetchImpl(ENDPOINT, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal,
        })
      } catch (cause) {
        if (isAbort(cause)) throw cause
        lastError = new OpenRouterError(
          `OpenRouter request failed after ${attempt} attempts: ${cause.message}`,
          { attempts: attempt, cause },
        )
        if (attempt === maxAttempts) throw lastError
        await sleep(backoffMs(attempt))
        continue
      }

      const text = await response.text()

      if (response.ok) return { text, attempts: attempt }

      const message = errorMessageFrom(text, response.status)
      const error = new OpenRouterError(
        `OpenRouter request failed after ${attempt} attempts: ${response.status} ${message}`,
        { status: response.status, attempts: attempt, body: text },
      )

      if (!RETRYABLE_STATUS.has(response.status) || attempt === maxAttempts) {
        throw error
      }
      await sleep(retryAfterMs(response) ?? backoffMs(attempt))
    }

    throw lastError
  }

  /**
   * One chat completion.
   *
   * @param {object} params
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {string} [params.model]
   * @param {number} [params.temperature]
   * @param {number} [params.maxTokens]
   * @param {object} [params.responseFormat]
   * @param {AbortSignal} [params.signal]
   * @returns {Promise<{content: string, model: string, usage: object|undefined,
   *   finishReason: string|undefined, id: string|undefined, attempts: number}>}
   */
  async function chat({
    messages,
    model = config.model,
    temperature,
    maxTokens,
    responseFormat,
    signal,
    ...rest
  }) {
    const body = {
      model,
      messages,
      ...(temperature === undefined ? {} : { temperature }),
      ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
      ...(responseFormat === undefined ? {} : { response_format: responseFormat }),
      ...rest,
    }

    const { text, attempts } = await request(body, signal)

    let payload
    try {
      payload = JSON.parse(text)
    } catch (cause) {
      throw new OpenRouterError(
        `OpenRouter returned a body that is not JSON: ${text.slice(0, 200)}`,
        { cause },
      )
    }

    const choice = payload.choices?.[0]
    if (!choice) {
      throw new OpenRouterError(
        `OpenRouter returned no choices: ${text.slice(0, 200)}`,
      )
    }

    return {
      content: choice.message?.content ?? '',
      model: payload.model ?? model,
      usage: payload.usage,
      finishReason: choice.finish_reason,
      id: payload.id,
      attempts,
    }
  }

  /**
   * A chat completion constrained to a JSON schema, validated on our side.
   *
   * @param {object} params
   * @param {Array<{role: string, content: string}>} params.messages
   * @param {object} params.schema
   * @param {string} params.schemaName
   * @returns {Promise<object>} the validated object
   */
  async function chatStructured({ messages, schema, schemaName = 'result', ...params }) {
    const responseFormat = {
      type: 'json_schema',
      json_schema: { name: schemaName, strict: true, schema },
    }

    let conversation = messages
    let lastErrors = []
    const maxRepairs = 2

    for (let attempt = 1; attempt <= maxRepairs; attempt += 1) {
      const answer = await chat({ ...params, messages: conversation, responseFormat })

      let parsed
      try {
        parsed = parseJsonAnswer(answer.content)
      } catch (error) {
        lastErrors = [error.message]
        conversation = repair(conversation, answer.content, lastErrors)
        continue
      }

      const { valid, errors } = validate(parsed, schema)
      if (valid) return parsed

      lastErrors = errors
      conversation = repair(conversation, answer.content, errors)
    }

    throw new OpenRouterError(
      `${schemaName} did not match its schema after ${maxRepairs} attempts: ${lastErrors.join('; ')}`,
      { validationErrors: lastErrors },
    )
  }

  function repair(conversation, answer, errors) {
    return [
      ...conversation,
      { role: 'assistant', content: answer },
      {
        role: 'user',
        content: [
          'That answer did not match the schema:',
          ...errors.map((error) => `- ${error}`),
          'Reply with the corrected JSON object and nothing else.',
        ].join('\n'),
      },
    ]
  }

  return { chat, chatStructured, model: config.model }
}
