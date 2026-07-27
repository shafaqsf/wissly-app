import 'server-only'

import {
  setDefaultOpenAIClient as sdkSetDefaultOpenAIClient,
  setOpenAIAPI as sdkSetOpenAIAPI,
  setTracingDisabled as sdkSetTracingDisabled,
} from '@openai/agents'
import OpenAI from 'openai'

import { openRouterConfigFromEnv } from './openrouter.js'

/**
 * The agent runtime — where `@openai/agents` meets OpenRouter.
 *
 * The SDK is provider-agnostic in the sense that it speaks the OpenAI wire
 * format, not in the sense that it works out of the box against anything that
 * does. Two of its defaults are wrong for us, and both fail in ways that are
 * hard to read from the error:
 *
 * - It reaches for OpenAI's **Responses API**. OpenRouter serves chat
 *   completions. `setOpenAIAPI('chat_completions')` is the fix, and without it
 *   every call 404s against an endpoint that was never there.
 * - It **exports traces** to OpenAI's backend, keyed by an OpenAI API key we
 *   do not have. The observability wissly actually wants is the `agent_runs`
 *   and `agent_actions` tables: per learner, under row level security, and
 *   durable. Tracing is switched off rather than left to fail quietly.
 *
 * `OPENROUTER_API_KEY` is a bearer token with a spend limit on it, so this
 * module is `server-only` for the same reason `openrouter.js` is.
 *
 * Every setter the SDK offers is global to the process, so configuration
 * happens once and later calls are a no-op. That is also why the SDK entry
 * points are injectable: a memo that cannot be cleared is a memo that can only
 * be tested once.
 */

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

let configured = null

/**
 * Configure the SDK against OpenRouter. Idempotent.
 *
 * @param {object} [options]
 * @param {Record<string, string|undefined>} [options.env]
 * @param {typeof OpenAI} [options.OpenAI]
 * @param {Function} [options.setDefaultOpenAIClient]
 * @param {Function} [options.setOpenAIAPI]
 * @param {Function} [options.setTracingDisabled]
 * @returns {{model: string, apiKey: string, siteUrl?: string, siteName?: string}}
 *   the resolved config, so a second OpenRouter client — the structured one
 *   generation uses — can be built from it without reading the environment
 *   a second time.
 */
export function configureAgentRuntime({
  env = process.env,
  OpenAI: OpenAIClient = OpenAI,
  setDefaultOpenAIClient = sdkSetDefaultOpenAIClient,
  setOpenAIAPI = sdkSetOpenAIAPI,
  setTracingDisabled = sdkSetTracingDisabled,
} = {}) {
  if (configured) return configured

  // Throws when the key or the model is missing. Deliberately before any
  // setter runs: a half-configured global is worse than an unconfigured one.
  const config = openRouterConfigFromEnv(env)

  const defaultHeaders = {
    ...(config.siteUrl ? { 'HTTP-Referer': config.siteUrl } : {}),
    ...(config.siteName ? { 'X-Title': config.siteName } : {}),
  }

  setDefaultOpenAIClient(
    new OpenAIClient({
      apiKey: config.apiKey,
      baseURL: OPENROUTER_BASE_URL,
      ...(Object.keys(defaultHeaders).length > 0 ? { defaultHeaders } : {}),
    }),
  )
  setOpenAIAPI('chat_completions')
  setTracingDisabled(true)

  configured = {
    model: config.model,
    apiKey: config.apiKey,
    siteUrl: config.siteUrl,
    siteName: config.siteName,
  }
  return configured
}

/** Clear the memo. For tests; the process configures itself once. */
export function resetAgentRuntime() {
  configured = null
}
