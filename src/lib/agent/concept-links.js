import 'server-only'

/**
 * Concept relatedness — one model call per course, judging which of this
 * course's concepts are worth a "see also" link to a concept already
 * elsewhere in the learner's library.
 *
 * There is no embedding capability in this project: no pgvector extension in
 * the migrations, no embeddings endpoint wired into `openrouter.js`. Adding
 * one would mean a second provider integration to store and query vectors,
 * and the result would still need an LLM pass afterwards to write the
 * one-sentence reason a "See also" list wants to show. `chatStructured` is
 * already the pipeline stage 1 pays for per section, so reusing it here —
 * with the term and definition already on hand, no extra fetch — is the
 * cheapest way to get a relatedness judgement that explains itself.
 *
 * Every concept on both sides is given a short token (`a1`, `b1`, …) rather
 * than its uuid: a model asked to copy a uuid back verbatim drops characters
 * often enough to be a real failure mode, and a token chosen from a short
 * enumerated list is not.
 */

const SYSTEM_PROMPT = [
  'You judge whether two ideas from a learner\'s course library are related',
  'closely enough to be worth a "see also" link. A link is worth making when',
  'knowing one genuinely helps in understanding or recalling the other — not',
  'because they share a broad subject. Skip anything only loosely related.',
  'Reply with JSON only.',
].join(' ')

function token(prefix, index) {
  return `${prefix}${index + 1}`
}

function block(prefix, concepts) {
  return concepts
    .map((concept, index) => {
      const definition = concept.definition ? ` — ${concept.definition}` : ''
      const course = concept.courseTitle ? ` (course: ${concept.courseTitle})` : ''
      return `${token(prefix, index)}: ${concept.term}${definition}${course}`
    })
    .join('\n')
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['links'],
  properties: {
    links: {
      type: 'array',
      maxItems: 40,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['concept', 'related', 'reason'],
        properties: {
          concept: { type: 'string', minLength: 2, description: 'a token from list A' },
          related: { type: 'string', minLength: 2, description: 'a token from list B' },
          reason: {
            type: 'string',
            minLength: 1,
            description: 'one sentence on why the two belong together',
          },
        },
      },
    },
  },
}

/**
 * @param {object} params
 * @param {object} params.client an OpenRouter client (`chatStructured`)
 * @param {Array<{id: string, term: string, definition?: string}>} params.concepts
 *   the course's own concepts — list A
 * @param {Array<{id: string, term: string, definition?: string, courseTitle?: string}>} params.candidates
 *   concepts from elsewhere in the library — list B
 * @returns {Promise<Array<{conceptId: string, relatedConceptId: string, reason: string}>>}
 */
export async function suggestConceptLinks({ client, concepts = [], candidates = [], ...params }) {
  if (concepts.length === 0 || candidates.length === 0) return []

  const answer = await client.chatStructured({
    ...params,
    schemaName: 'concept_links',
    schema: SCHEMA,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          'List A, the course just updated:',
          block('a', concepts),
          '',
          'List B, everything else in the library:',
          block('b', candidates),
          '',
          'Return every pair from A to B worth a "see also" link. Return no',
          'pairs at all if nothing in B is genuinely related to anything in A.',
        ].join('\n'),
      },
    ],
  })

  const idByToken = (prefix, list) =>
    new Map(list.map((concept, index) => [token(prefix, index), concept.id]))

  const conceptIds = idByToken('a', concepts)
  const candidateIds = idByToken('b', candidates)

  const links = []
  const seen = new Set()

  for (const link of answer.links ?? []) {
    const conceptId = conceptIds.get(link.concept)
    const relatedConceptId = candidateIds.get(link.related)
    if (!conceptId || !relatedConceptId || conceptId === relatedConceptId) continue

    const key = [conceptId, relatedConceptId].sort().join('::')
    if (seen.has(key)) continue
    seen.add(key)

    links.push({ conceptId, relatedConceptId, reason: link.reason })
  }

  return links
}
