import 'server-only'

import { Agent } from '@openai/agents'

import { readOnlyTools } from './tools.js'

/**
 * The agents.
 *
 * One per job, connected by handoffs. The specialisation is not tidiness: an
 * agent whose only tools read cannot write, and that is a cheaper guarantee
 * than any sentence in a prompt. Chat mode is chat mode because of which
 * tools it was handed, not because it was asked nicely.
 *
 * This module builds the read-only half — the Librarian, and the router in
 * front of it. The Maker, the Examiner and the Steward arrive with the
 * writing tools and `agent_actions`.
 */

/** How an answer points at the passage it came from. */
export const ANCHOR_PATTERN = /\[s:([0-9a-zA-Z-]+)\]/g

const CITATION_RULE = [
  'Every sentence that states something from the material ends with a marker',
  'naming the passage it came from, written exactly as [s:SECTION_ID] using the',
  'section_id a tool returned. Never invent an id, and never cite a passage you',
  'did not read.',
].join(' ')

export const LIBRARIAN_INSTRUCTIONS = [
  'You answer questions about the learner’s own study material for wissly.',
  '',
  'Search before you answer. If the material does not cover the question, say',
  'so plainly and stop — do not fall back on what you happen to know. A wrong',
  'answer with a confident tone is the one failure this product cannot afford,',
  'because the learner will memorise it.',
  '',
  CITATION_RULE,
  '',
  'Write in the language the learner writes in. Be brief: prose here is read',
  'in a narrow column, and a long answer is a worse answer.',
].join('\n')

/**
 * Did this answer read the material and then fail to say where from?
 *
 * The guardrail cannot judge whether a claim is faithful — that would take
 * another model and would still be a guess. It can judge something narrower
 * and worth enforcing: an answer built on passages the agent just read must
 * carry at least one anchor. That is the promise the interface renders, and
 * an answer without one has quietly dropped it.
 *
 * An answer that read nothing is left alone. "I could not find that in your
 * material" is a correct answer with nothing to cite.
 *
 * @param {{answer: string, passagesRead: number}} params
 * @returns {boolean} true when the answer must be rejected
 */
export function missingAnchors({ answer, passagesRead }) {
  if (passagesRead <= 0) return false
  return String(answer ?? '').match(ANCHOR_PATTERN) === null
}

/** The section ids an answer cited, in the order it cited them. */
export function citedSections(answer) {
  return [...String(answer ?? '').matchAll(ANCHOR_PATTERN)].map((match) => match[1])
}

/**
 * The output guardrail, in the shape the SDK expects.
 *
 * `passagesRead` is counted by the caller as tool results arrive, because the
 * guardrail sees the answer and not the run that produced it.
 */
export function anchorGuardrail(countPassagesRead) {
  return {
    name: 'answers cite the material',
    async execute({ agentOutput }) {
      const passagesRead = countPassagesRead()
      const tripwireTriggered = missingAnchors({
        answer: typeof agentOutput === 'string' ? agentOutput : agentOutput?.text,
        passagesRead,
      })

      return {
        tripwireTriggered,
        outputInfo: { passagesRead },
      }
    },
  }
}

/**
 * The Librarian: finds material, answers from it, always with an anchor.
 *
 * @param {object} params
 * @param {object} params.supabase the request-scoped client
 * @param {string} params.model
 * @param {() => number} [params.passagesRead] how many passages the run read
 */
export function createLibrarian({ supabase, model, passagesRead = () => 0 }) {
  return new Agent({
    name: 'Librarian',
    instructions: LIBRARIAN_INSTRUCTIONS,
    model,
    tools: readOnlyTools(supabase),
    outputGuardrails: [anchorGuardrail(passagesRead)],
  })
}
