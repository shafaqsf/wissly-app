// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  CURATED_MODELS,
  DEFAULT_MODEL_ENV,
  isModelId,
  resolveModel,
} from './models.js'

describe('CURATED_MODELS', () => {
  it('is the three the bar offers, priced, because the price is the choice', () => {
    expect(CURATED_MODELS.map((model) => model.id)).toEqual([
      'deepseek/deepseek-v4-pro',
      'anthropic/claude-sonnet-5',
      'openai/gpt-5.6-luna',
    ])

    for (const model of CURATED_MODELS) {
      expect(model.name.length, model.id).toBeGreaterThan(2)
      expect(model.pricing.input, model.id).toBeGreaterThan(0)
      expect(model.pricing.output, model.id).toBeGreaterThan(0)
    }
  })

  it('cannot be edited by whoever imports it', () => {
    expect(Object.isFrozen(CURATED_MODELS)).toBe(true)
    expect(Object.isFrozen(CURATED_MODELS[0])).toBe(true)
  })
})

describe('isModelId', () => {
  it('accepts any vendor/model, because the catalogue has hundreds', () => {
    expect(isModelId('deepseek/deepseek-v4-pro')).toBe(true)
    expect(isModelId('some-vendor/some.model-v2')).toBe(true)
    expect(isModelId('meta-llama/llama-4-70b:free')).toBe(true)
  })

  it('rejects what is not a model id at all', () => {
    expect(isModelId('')).toBe(false)
    expect(isModelId('claude')).toBe(false)
    expect(isModelId('/model')).toBe(false)
    expect(isModelId('vendor/')).toBe(false)
    expect(isModelId('a/b/c')).toBe(false)
    expect(isModelId('vendor/model with spaces')).toBe(false)
    expect(isModelId(null)).toBe(false)
  })

  it('checks the shape and not the existence, which only OpenRouter knows', () => {
    expect(isModelId('nobody/nothing-at-all')).toBe(true)
  })
})

describe('resolveModel', () => {
  const env = { [DEFAULT_MODEL_ENV]: 'anthropic/claude-opus-5' }

  it('takes what the learner chose', () => {
    expect(resolveModel({ chosen: 'openai/gpt-5.6-luna', env })).toBe('openai/gpt-5.6-luna')
  })

  it('takes free text outside the curated three', () => {
    expect(resolveModel({ chosen: 'x-ai/grok-9', env })).toBe('x-ai/grok-9')
  })

  it('falls back to the environment for a learner who has never chosen', () => {
    expect(resolveModel({ chosen: null, env })).toBe('anthropic/claude-opus-5')
    expect(resolveModel({ chosen: '  ', env })).toBe('anthropic/claude-opus-5')
    expect(resolveModel({ env })).toBe('anthropic/claude-opus-5')
  })

  it('refuses a malformed id rather than sending it to the provider', () => {
    expect(() => resolveModel({ chosen: 'claude', env })).toThrow(/vendor\/model/i)
  })

  it('says what to do when nothing is configured at all', () => {
    expect(() => resolveModel({ chosen: null, env: {} })).toThrow(/OPENROUTER_MODEL/)
  })

  it('falls back to the learner’s stored preference before the environment', () => {
    expect(
      resolveModel({ chosen: null, preferred: 'deepseek/deepseek-v4-pro', env }),
    ).toBe('deepseek/deepseek-v4-pro')
  })

  it('prefers what was chosen for this message over the stored preference', () => {
    expect(
      resolveModel({
        chosen: 'openai/gpt-5.6-luna',
        preferred: 'deepseek/deepseek-v4-pro',
        env,
      }),
    ).toBe('openai/gpt-5.6-luna')
  })

  it('ignores a blank preference and falls through to the environment', () => {
    expect(resolveModel({ chosen: null, preferred: '  ', env })).toBe(
      'anthropic/claude-opus-5',
    )
  })

  it('refuses a malformed stored preference rather than sending it to the provider', () => {
    expect(() => resolveModel({ chosen: null, preferred: 'claude', env })).toThrow(
      /vendor\/model/i,
    )
  })
})
