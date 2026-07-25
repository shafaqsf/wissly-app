/**
 * Which model answers.
 *
 * Chosen per message, in the bar, beside the mode — and recorded on the
 * message, so the transcript can say which model wrote which line. Two things
 * follow from that, and both are why this is a module rather than a constant.
 *
 * **The list is a suggestion, not a boundary.** Three curated ids with their
 * prices cover the ordinary choice; the free field takes anything OpenRouter
 * serves, because a curated list of three goes stale and the catalogue has
 * hundreds. So `isModelId` validates the *shape* of an id and nothing else.
 * Whether `nobody/nothing-at-all` exists is a question only OpenRouter can
 * answer, and answering it here would mean a network call before every send.
 *
 * **Mode and model are independent.** Nothing in this file knows about chat or
 * agent. Chat on Sonnet while the Agent works on DeepSeek is a normal
 * configuration, and it stays normal precisely because these two settings never
 * meet.
 *
 * No `server-only` here: the bar is a client component and it renders this
 * list. There is nothing secret in it — the ids are public and the prices are
 * published.
 */

/** The environment variable that answers for a learner who has never chosen. */
export const DEFAULT_MODEL_ENV = 'OPENROUTER_MODEL'

/**
 * The three the bar offers by name. Prices are US dollars per million tokens,
 * input then output, and they are shown rather than enforced: there is no
 * spending cap in wissly, deliberately. Cost is made visible so the learner can
 * decide, which is a different thing from being decided for.
 */
export const CURATED_MODELS = Object.freeze([
  Object.freeze({
    id: 'deepseek/deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    pricing: Object.freeze({ input: 0.44, output: 0.87 }),
  }),
  Object.freeze({
    id: 'anthropic/claude-sonnet-5',
    name: 'Claude Sonnet 5',
    pricing: Object.freeze({ input: 2.0, output: 10.0 }),
  }),
  Object.freeze({
    id: 'openai/gpt-5.6-luna',
    name: 'GPT-5.6 Luna',
    pricing: Object.freeze({ input: 1.0, output: 6.0 }),
  }),
])

/* `vendor/model`, with an optional `:variant` suffix — OpenRouter writes
 * `:free` and `:nitro` that way. One slash, no spaces, no path traversal. */
const MODEL_ID = /^[\w.-]+\/[\w.-]+(:[\w.-]+)?$/

/** @param {unknown} id @returns {boolean} */
export function isModelId(id) {
  return typeof id === 'string' && MODEL_ID.test(id)
}

/** The curated entry for an id, or null when it came from the free field. */
export function curatedModel(id) {
  return CURATED_MODELS.find((model) => model.id === id) ?? null
}

/**
 * The model this message gets.
 *
 * @param {object} params
 * @param {string|null} [params.chosen] what the bar sent, if anything
 * @param {Record<string, string|undefined>} [params.env]
 * @returns {string}
 */
export function resolveModel({ chosen, env = process.env } = {}) {
  const wanted = String(chosen ?? '').trim()

  if (wanted !== '') {
    if (!isModelId(wanted)) {
      throw new Error(
        `"${wanted}" is not an OpenRouter model id. They are written vendor/model, like anthropic/claude-sonnet-5.`,
      )
    }
    return wanted
  }

  const fallback = String(env[DEFAULT_MODEL_ENV] ?? '').trim()
  if (fallback === '') {
    throw new Error(
      `${DEFAULT_MODEL_ENV} is not set and no model was chosen. There is no safe default: the model decides the cost.`,
    )
  }

  return fallback
}
