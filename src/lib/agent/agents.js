import 'server-only'

import { Agent } from '@openai/agents'

import { readOnlyTools } from './tools.js'
import { writeTools } from './write-tools.js'

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

export const STEWARD_INSTRUCTIONS = [
  'You act on the learner’s own study material for wissly, on their behalf.',
  '',
  'Read before you write. Find the passage, then work on it — never generate',
  'from a section you have not read, and never rename something you have not',
  'looked up.',
  '',
  'Do what was asked and stop. If the request is ambiguous about how much —',
  '"make some cards" — take the smallest reading of it and say what you did,',
  'so the learner can ask for more. Guessing large is not helpful; it is',
  'expensive, and it fills their review queue with work they did not choose.',
  '',
  'Every change you make can be undone by the learner, so say plainly what you',
  'changed. Never describe a change you did not make.',
  '',
  CITATION_RULE,
].join('\n')

/**
 * The Steward: acts for the learner.
 *
 * The reading tools come along with the writing ones, and not as a
 * convenience: a write to a passage the agent never read is a write to a
 * passage it invented.
 *
 * `runId` is required. An action that cannot be attributed to a run is one the
 * learner cannot find in order to undo it.
 */
export function createSteward({
  supabase,
  model,
  userId,
  runId,
  client,
  passagesRead = () => 0,
}) {
  if (!runId) throw new Error('the steward needs a run to attribute its actions to')

  return new Agent({
    name: 'Steward',
    instructions: STEWARD_INSTRUCTIONS,
    model,
    tools: [...readOnlyTools(supabase), ...writeTools(supabase, { userId, runId, client })],
    outputGuardrails: [anchorGuardrail(passagesRead)],
  })
}

/**
 * The agent a mode gets.
 *
 * This function is the whole of the promise the mode switch makes. Chat mode
 * cannot write because the agent it produces holds no tool that writes — not
 * because a prompt asked it nicely, and not because the interface disabled a
 * button.
 */
export function agentForMode({ mode, ...params }) {
  return mode === 'agent' ? createSteward(params) : createLibrarian(params)
}
