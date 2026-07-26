import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OpenRouterError } from './openrouter.js'
import {
  OPENROUTER_BASE_URL,
  configureAgentRuntime,
  resetAgentRuntime,
} from './runtime.js'

/**
 * The runtime is the one place where the SDK meets OpenRouter, and the two
 * settings it gets wrong by default are the two that break silently: the SDK
 * reaches for OpenAI's Responses API, which OpenRouter does not serve, and it
 * ships traces to a backend we do not use. Both are asserted here rather than
 * discovered in production.
 */

function stubs() {
  return {
    OpenAI: vi.fn(function OpenAI(options) {
      this.options = options
    }),
    setDefaultOpenAIClient: vi.fn(),
    setOpenAIAPI: vi.fn(),
    setTracingDisabled: vi.fn(),
  }
}

const env = {
  OPENROUTER_API_KEY: 'sk-or-test',
  OPENROUTER_MODEL: 'anthropic/claude-opus-5',
  OPENROUTER_SITE_URL: 'https://wissly.test',
  OPENROUTER_SITE_NAME: 'wissly',
}

describe('configureAgentRuntime', () => {
  // The SDK's setters are global, so the runtime configures itself exactly
  // once per process. Tests need that memo cleared between them or only the
  // first one would see a call.
  beforeEach(() => resetAgentRuntime())

  it('points the SDK at OpenRouter with the key from the environment', () => {
    const sdk = stubs()

    configureAgentRuntime({ env, ...sdk })

    expect(sdk.setDefaultOpenAIClient).toHaveBeenCalledTimes(1)
    const [client] = sdk.setDefaultOpenAIClient.mock.calls[0]
    expect(client.options.baseURL).toBe(OPENROUTER_BASE_URL)
    expect(client.options.apiKey).toBe('sk-or-test')
  })

  it('sends the attribution headers OpenRouter ranks on', () => {
    const sdk = stubs()

    configureAgentRuntime({ env, ...sdk })

    const [client] = sdk.setDefaultOpenAIClient.mock.calls[0]
    expect(client.options.defaultHeaders).toMatchObject({
      'HTTP-Referer': 'https://wissly.test',
      'X-Title': 'wissly',
    })
  })

  it('omits the attribution headers when nothing is configured', () => {
    const sdk = stubs()

    configureAgentRuntime({
      env: { OPENROUTER_API_KEY: 'sk-or-test', OPENROUTER_MODEL: 'm' },
      ...sdk,
    })

    const [client] = sdk.setDefaultOpenAIClient.mock.calls[0]
    expect(client.options.defaultHeaders ?? {}).not.toHaveProperty('HTTP-Referer')
  })

  it('selects chat completions, because OpenRouter does not serve the Responses API', () => {
    const sdk = stubs()

    configureAgentRuntime({ env, ...sdk })

    expect(sdk.setOpenAIAPI).toHaveBeenCalledWith('chat_completions')
  })

  it('disables tracing, because it ships to a backend we do not use', () => {
    const sdk = stubs()

    configureAgentRuntime({ env, ...sdk })

    expect(sdk.setTracingDisabled).toHaveBeenCalledWith(true)
  })

  it('returns the configured model so callers need not read the environment again', () => {
    const sdk = stubs()

    expect(configureAgentRuntime({ env, ...sdk })).toEqual({
      model: 'anthropic/claude-opus-5',
      apiKey: 'sk-or-test',
      siteUrl: 'https://wissly.test',
      siteName: 'wissly',
    })
  })

  it('returns the rest of the config too, so a second client can be built for generation', () => {
    const sdk = stubs()

    const config = configureAgentRuntime({
      env: { OPENROUTER_API_KEY: 'sk-or-test', OPENROUTER_MODEL: 'm' },
      ...sdk,
    })

    expect(config).toEqual({ model: 'm', apiKey: 'sk-or-test', siteUrl: undefined, siteName: undefined })
  })

  it('refuses to configure anything without a key', () => {
    const sdk = stubs()

    expect(() =>
      configureAgentRuntime({ env: { OPENROUTER_MODEL: 'm' }, ...sdk }),
    ).toThrow(OpenRouterError)
    expect(sdk.setDefaultOpenAIClient).not.toHaveBeenCalled()
  })

  it('refuses to configure anything without a model, because the model is the cost', () => {
    const sdk = stubs()

    expect(() =>
      configureAgentRuntime({ env: { OPENROUTER_API_KEY: 'k' }, ...sdk }),
    ).toThrow(OpenRouterError)
    expect(sdk.setDefaultOpenAIClient).not.toHaveBeenCalled()
  })

  it('configures once, however often it is called', () => {
    const sdk = stubs()

    configureAgentRuntime({ env, ...sdk })
    configureAgentRuntime({ env, ...sdk })

    expect(sdk.setDefaultOpenAIClient).toHaveBeenCalledTimes(1)
  })
})
