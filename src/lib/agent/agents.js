import 'server-only'

import { Agent } from '@openai/agents'

import { READ_ONLY_TOOLS, readOnlyTools } from './tools.js'
import { WRITE_TOOLS, writeTools } from './write-tools.js'

/**
 * The agents.
 *
 * One per job, connected by handoffs. The specialisation is not tidiness: an
 * agent whose only tools read cannot write, and that is a cheaper guarantee
 * than any sentence in a prompt. Chat mode is chat mode because of which
 * tools it was handed, not because it was asked nicely.
 *
 * | Role      | Does                                        |
 * | --------- | ------------------------------------------- |
 * | Librarian | Finds material, answers from it, with anchors |
 * | Maker     | Turns passages into tasks and reading       |
 * | Examiner  | Asks, grades, records evidence, reschedules |
 * | Steward   | Acts for the learner across all of it       |
 *
 * The bar talks to a **router** in agent mode. It holds no tools of its own and
 * hands off, which means the tool list any one turn can reach is the list of
 * whichever specialist took it — a smaller surface than "everything", chosen by
 * what was asked rather than by a flag.
 */

/** How an answer points at the passage it came from. */
export const ANCHOR_PATTERN = /\[s:([0-9a-zA-Z-]+)\]/g

export const ROLES = Object.freeze(['Librarian', 'Maker', 'Examiner', 'Steward'])

const READING = READ_ONLY_TOOLS.map((definition) => definition.name)
const WRITING = WRITE_TOOLS.map((definition) => definition.name)

/**
 * Which tools each role holds.
 *
 * Exported because the bar has to be able to tell the learner what the agent
 * may do, and a list assembled a second time in a component would drift from
 * this one the first time a tool was added.
 */
export const TOOLS_BY_ROLE = Object.freeze({
  Librarian: Object.freeze([...READING]),
  Maker: Object.freeze([
    ...READING,
    'make_artefacts',
    'write_artefact',
    'edit_artefact',
    'archive_tasks',
    'show_in_interface',
  ]),
  Examiner: Object.freeze([
    ...READING,
    'grade_answer',
    'record_review',
    'reschedule_tasks',
    'show_in_interface',
  ]),
  Steward: Object.freeze([...READING, ...WRITING]),
})

const CITATION_RULE = [
  'Every sentence that states something from the material ends with a marker',
  'naming the passage it came from, written exactly as [s:SECTION_ID] using the',
  'section_id a tool returned. Never invent an id, and never cite a passage you',
  'did not read.',
].join(' ')

const ACCOUNTABILITY_RULE = [
  'Every change you make can be undone by the learner, so say plainly what you',
  'changed and how much of it. Never describe a change you did not make, and',
  'never claim a count you did not check.',
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

export const MAKER_INSTRUCTIONS = [
  'You turn the learner’s material into tasks and reading for wissly.',
  '',
  'Read the passage before you generate from it. Check what already exists',
  'first with list_tasks or list_reading — a second flashcard on a passage that',
  'already has one is a duplicate the learner then has to find and archive.',
  '',
  'Every generation is a model call the learner pays for. Take the smallest',
  'reading of an ambiguous request — "make some cards" is three, not thirty —',
  'and say what you made so they can ask for more.',
  '',
  'Four formats are answered and run through review: flashcard, cloze,',
  'multiple_choice, open_question. Two are read and never scheduled: summary,',
  'glossary. Choose by what the passage is, not by what is quickest.',
  '',
  ACCOUNTABILITY_RULE,
  '',
  CITATION_RULE,
].join('\n')

export const EXAMINER_INSTRUCTIONS = [
  'You test the learner on their own material for wissly, and record what',
  'happened.',
  '',
  'Ask what is due. Grade exactly and unsentimentally: name what was missing',
  'rather than softening it, and never credit a point the learner did not make.',
  'Praise that is not earned makes the schedule wrong, and the schedule is the',
  'product.',
  '',
  'Record a rating only for a question the learner actually answered. A review',
  'you invented moves their mastery on evidence that does not exist.',
  '',
  ACCOUNTABILITY_RULE,
  '',
  CITATION_RULE,
].join('\n')

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
  'Nothing you archive is deleted, and nothing you delete exists — there is no',
  'tool that destroys what the learner brought. When they ask you to get rid of',
  'something, archive it and tell them where it went.',
  '',
  'When a result has a place in the interface, take them there with',
  'show_in_interface rather than describing where to click.',
  '',
  ACCOUNTABILITY_RULE,
  '',
  CITATION_RULE,
].join('\n')

export const ROUTER_INSTRUCTIONS = [
  'You decide who answers, and you answer nothing yourself.',
  '',
  'Hand a question about what the material says to the Librarian. Hand a',
  'request to make, edit or tidy tasks and reading to the Maker. Hand testing,',
  'grading and rescheduling to the Examiner. Hand anything that spans them —',
  'adding material, creating or renaming a course, standing orders, or a task',
  'with several steps — to the Steward.',
  '',
  'Hand off immediately. Do not restate the request, and do not ask which one',
  'the learner meant unless the request names no subject at all.',
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
 * Build one role.
 *
 * `runId` is required for every role that writes. An action that cannot be
 * attributed to a run is one the learner cannot find in order to undo it, so
 * the agent refuses to exist rather than acting untraceably.
 */
function role(
  name,
  instructions,
  { supabase, model, userId, runId, client, onIntent, passagesRead = () => 0 },
) {
  const writing = TOOLS_BY_ROLE[name].filter((tool) => WRITING.includes(tool))

  if (writing.length > 0 && !runId) {
    throw new Error(`the ${name} needs a run to attribute its actions to`)
  }

  return new Agent({
    name,
    instructions,
    model,
    tools: [
      ...readOnlyTools(supabase),
      ...(writing.length > 0
        ? writeTools(supabase, { userId, runId, client, onIntent, only: writing })
        : []),
    ],
    outputGuardrails: [anchorGuardrail(passagesRead)],
  })
}

/** The Librarian: finds material, answers from it, always with an anchor. */
export function createLibrarian(params) {
  return role('Librarian', LIBRARIAN_INSTRUCTIONS, params)
}

/** The Maker: turns passages into tasks and reading. */
export function createMaker(params) {
  return role('Maker', MAKER_INSTRUCTIONS, params)
}

/** The Examiner: asks, grades, records evidence. */
export function createExaminer(params) {
  return role('Examiner', EXAMINER_INSTRUCTIONS, params)
}

/**
 * The Steward: acts for the learner, across the whole surface.
 *
 * The reading tools come along with the writing ones, and not as a
 * convenience: a write to a passage the agent never read is a write to a
 * passage it invented.
 */
export function createSteward(params) {
  return role('Steward', STEWARD_INSTRUCTIONS, params)
}

/**
 * The router: holds nothing, decides who acts.
 *
 * It is built with the writing roles behind it, so it demands a run for the
 * same reason they do — by the time a handoff has happened it is too late to
 * discover there is nowhere to record what follows.
 */
export function createRouter(params) {
  if (!params?.runId) throw new Error('the router needs a run to attribute its actions to')

  return new Agent({
    name: 'Router',
    instructions: ROUTER_INSTRUCTIONS,
    model: params.model,
    tools: [],
    handoffs: [
      createLibrarian(params),
      createMaker(params),
      createExaminer(params),
      createSteward(params),
    ],
    outputGuardrails: [anchorGuardrail(params.passagesRead ?? (() => 0))],
  })
}

/**
 * The agent a mode gets.
 *
 * This function is the whole of the promise the mode switch makes. Chat mode
 * cannot write because the agent it produces holds no tool that writes — not
 * because a prompt asked it nicely, and not because the interface disabled a
 * button.
 *
 * The model is whatever it was handed. Mode and model never meet: Chat on
 * Sonnet while the Agent works on DeepSeek is an ordinary configuration.
 */
export function agentForMode({ mode, ...params }) {
  return mode === 'agent' ? createRouter(params) : createLibrarian(params)
}
