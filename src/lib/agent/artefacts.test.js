// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import {
  chooseFormat,
  generateArtefact,
  generateArtefacts,
  gradeAnswer,
} from './artefacts.js'

const section = {
  id: 'sec-1',
  ordinal: 3,
  content: 'A monad is a monoid in the category of endofunctors.',
  anchor: { page: 7 },
}

const flashcard = { front: 'What is a monad?', back: 'A monoid in the category of endofunctors.' }

/** A client whose structured calls are scripted, one per call. */
function stubClient(...answers) {
  const chatStructured = vi.fn(async () => answers.shift() ?? {})
  return { chatStructured, chat: vi.fn() }
}

describe('chooseFormat', () => {
  it('asks the model which format the section deserves', async () => {
    const client = stubClient({ format: 'flashcard', reason: 'It is a definition.' })

    await expect(chooseFormat({ client, section })).resolves.toEqual({
      format: 'flashcard',
      reason: 'It is a definition.',
    })
  })

  it('constrains the answer to the formats a section can be generated from', async () => {
    const client = stubClient({ format: 'cloze', reason: 'Key term.' })
    await chooseFormat({ client, section })

    const { schema } = client.chatStructured.mock.calls[0][0]
    expect(schema.properties.format.enum).toEqual([
      'summary',
      'glossary',
      'flashcard',
      'cloze',
      'multiple_choice',
      'open_question',
      'comparison_table',
      'ordering',
    ])
  })

  it('never offers practice_exam, which is composed rather than chosen', async () => {
    const client = stubClient({ format: 'cloze', reason: 'Key term.' })
    await chooseFormat({ client, section })

    const { schema } = client.chatStructured.mock.calls[0][0]
    expect(schema.properties.format.enum).not.toContain('practice_exam')
  })

  it('puts the section text in the prompt', async () => {
    const client = stubClient({ format: 'cloze', reason: 'Key term.' })
    await chooseFormat({ client, section })

    const { messages } = client.chatStructured.mock.calls[0][0]
    expect(messages.at(-1).content).toContain(section.content)
    expect(messages[0].role).toBe('system')
  })

  it('refuses a format outside the catalogue even if the model returns one', async () => {
    const client = stubClient({ format: 'concept_map', reason: 'Why not.' })

    await expect(chooseFormat({ client, section })).rejects.toThrow(
      /unknown artefact format "concept_map"/,
    )
  })
})

describe('generateArtefact', () => {
  it('generates a payload for the requested format', async () => {
    const client = stubClient(flashcard)

    const artefact = await generateArtefact({ client, section, format: 'flashcard' })

    expect(artefact.format).toBe('flashcard')
    expect(artefact.payload).toEqual(flashcard)
  })

  it('carries the section it came from, so the UI can render the citation', async () => {
    const client = stubClient(flashcard)

    const artefact = await generateArtefact({ client, section, format: 'flashcard' })

    expect(artefact).toMatchObject({
      section_id: 'sec-1',
      section_ordinal: 3,
      anchor: { page: 7 },
    })
  })

  it('shapes itself like a row of the artefacts table', async () => {
    const client = stubClient(flashcard)

    const artefact = await generateArtefact({
      client,
      section,
      format: 'flashcard',
      subjectId: 'sub-9',
      conceptId: 'con-2',
    })

    expect(Object.keys(artefact).sort()).toEqual([
      'anchor',
      'concept_id',
      'format',
      'payload',
      'section_id',
      'section_ordinal',
      'subject_id',
    ])
    expect(artefact.subject_id).toBe('sub-9')
    expect(artefact.concept_id).toBe('con-2')
  })

  it('leaves the optional ids null rather than undefined, for the insert', async () => {
    const client = stubClient(flashcard)
    const artefact = await generateArtefact({ client, section, format: 'flashcard' })
    expect(artefact.subject_id).toBe(null)
    expect(artefact.concept_id).toBe(null)
  })

  it('asks for the payload schema of that format under its own name', async () => {
    const client = stubClient(flashcard)
    await generateArtefact({ client, section, format: 'flashcard' })

    const call = client.chatStructured.mock.calls[0][0]
    expect(call.schemaName).toBe('flashcard')
    expect(call.schema.required).toEqual(['front', 'back'])
  })

  it('rejects a format that is not in the catalogue before spending a call', async () => {
    const client = stubClient(flashcard)

    await expect(
      generateArtefact({ client, section, format: 'timeline' }),
    ).rejects.toThrow(/unknown artefact format "timeline"/)
    expect(client.chatStructured).not.toHaveBeenCalled()
  })

  it('rejects a payload that passes the schema but breaks a format rule', async () => {
    const client = stubClient({ text: 'No blank in here.', answer: 'endofunctors' })

    await expect(
      generateArtefact({ client, section, format: 'cloze' }),
    ).rejects.toThrow(/expected the blank marker/)
  })

  it('chooses the format itself when the caller does not name one', async () => {
    const client = stubClient({ format: 'flashcard', reason: 'Definition.' }, flashcard)

    const artefact = await generateArtefact({ client, section })

    expect(artefact.format).toBe('flashcard')
    expect(client.chatStructured).toHaveBeenCalledTimes(2)
  })

  it('generates a comparison table from one section', async () => {
    const comparisonTable = {
      items: ['Mean', 'Median'],
      dimensions: ['Sensitive to outliers', 'Always one of the data points'],
      cells: [
        { item_index: 0, dimension_index: 0, value: 'Yes', rationale: 'An extreme value shifts it.' },
        { item_index: 0, dimension_index: 1, value: 'No', rationale: 'It is an average, not a member.' },
        { item_index: 1, dimension_index: 0, value: 'No', rationale: 'Only the middle rank matters.' },
        { item_index: 1, dimension_index: 1, value: 'Usually', rationale: 'It is a data point for odd counts.' },
      ],
    }
    const client = stubClient(comparisonTable)

    const artefact = await generateArtefact({ client, section, format: 'comparison_table' })

    expect(artefact.payload).toEqual(comparisonTable)
  })

  it('generates an ordering task from one section', async () => {
    const ordering = {
      prompt: 'Order the steps.',
      items: ['First', 'Second', 'Third'],
      rationale: 'Each step depends on the one before it.',
    }
    const client = stubClient(ordering)

    const artefact = await generateArtefact({ client, section, format: 'ordering' })

    expect(artefact.payload).toEqual(ordering)
  })

  it('refuses to generate a practice_exam from one section, before spending a call', async () => {
    const client = stubClient(flashcard)

    await expect(
      generateArtefact({ client, section, format: 'practice_exam' }),
    ).rejects.toThrow(/composed from existing artefacts/)
    expect(client.chatStructured).not.toHaveBeenCalled()
  })
})

describe('generateArtefacts', () => {
  const sections = [
    { id: 'a', ordinal: 1, content: 'First.', anchor: { page: 1 } },
    { id: 'b', ordinal: 2, content: 'Second.', anchor: { page: 2 } },
  ]

  it('produces one artefact per section, in order', async () => {
    const client = stubClient(
      { format: 'flashcard', reason: 'r' },
      { front: '1', back: '1' },
      { format: 'flashcard', reason: 'r' },
      { front: '2', back: '2' },
    )

    const artefacts = await generateArtefacts({ client, sections })

    expect(artefacts.map((artefact) => artefact.section_id)).toEqual(['a', 'b'])
    expect(artefacts.map((artefact) => artefact.payload.front)).toEqual(['1', '2'])
  })

  it('applies one format to every section when the caller fixes it', async () => {
    const client = stubClient({ front: '1', back: '1' }, { front: '2', back: '2' })

    const artefacts = await generateArtefacts({ client, sections, format: 'flashcard' })

    expect(artefacts).toHaveLength(2)
    expect(client.chatStructured).toHaveBeenCalledTimes(2)
  })

  it('keeps going when one section fails, and reports which', async () => {
    const client = {
      chat: vi.fn(),
      chatStructured: vi
        .fn()
        .mockRejectedValueOnce(new Error('model refused'))
        .mockResolvedValueOnce({ front: '2', back: '2' }),
    }

    const { artefacts, failures } = await generateArtefacts({
      client,
      sections,
      format: 'flashcard',
      collectFailures: true,
    })

    expect(artefacts).toHaveLength(1)
    expect(artefacts[0].section_id).toBe('b')
    expect(failures).toEqual([{ section_id: 'a', error: 'model refused' }])
  })

  it('throws on the first failure when failures are not being collected', async () => {
    const client = {
      chat: vi.fn(),
      chatStructured: vi.fn().mockRejectedValue(new Error('model refused')),
    }

    await expect(
      generateArtefacts({ client, sections, format: 'flashcard' }),
    ).rejects.toThrow('model refused')
  })

  it('does nothing at all for an empty list of sections', async () => {
    const client = stubClient()
    await expect(generateArtefacts({ client, sections: [] })).resolves.toEqual([])
    expect(client.chatStructured).not.toHaveBeenCalled()
  })
})

describe('gradeAnswer', () => {
  const question = {
    prompt: 'What is a monad?',
    model_answer: 'A monoid in the category of endofunctors.',
    criteria: ['Mentions monoid', 'Mentions endofunctors'],
  }

  const grade = {
    verdict: 'partial',
    score: 0.5,
    missing: ['Mentions endofunctors'],
    feedback: 'You have the algebra. The category it lives in is missing.',
  }

  it('returns the verdict, the score and what was missing', async () => {
    const client = stubClient(grade)

    await expect(
      gradeAnswer({ client, question, answer: 'It is a monoid.', section }),
    ).resolves.toEqual(grade)
  })

  it('grades against the source, the model answer and the criteria', async () => {
    const client = stubClient(grade)

    await gradeAnswer({ client, question, answer: 'It is a monoid.', section })

    const prompt = client.chatStructured.mock.calls[0][0].messages.at(-1).content
    expect(prompt).toContain(section.content)
    expect(prompt).toContain(question.model_answer)
    expect(prompt).toContain('Mentions endofunctors')
    expect(prompt).toContain('It is a monoid.')
  })

  it('grades without a section, since a learner may answer from memory alone', async () => {
    const client = stubClient(grade)
    await expect(
      gradeAnswer({ client, question, answer: 'It is a monoid.' }),
    ).resolves.toEqual(grade)
  })

  it('refuses an empty answer without spending a call', async () => {
    const client = stubClient(grade)

    await expect(gradeAnswer({ client, question, answer: '   ' })).rejects.toThrow(
      /answer is empty/,
    )
    expect(client.chatStructured).not.toHaveBeenCalled()
  })

  it('rejects a grade whose score contradicts nothing being missing', async () => {
    const client = stubClient({ ...grade, verdict: 'correct', missing: ['a thing'] })

    await expect(
      gradeAnswer({ client, question, answer: 'It is a monoid.' }),
    ).rejects.toThrow(/verdict "correct" contradicts 1 missing point/)
  })

  it('rejects a grade that claims nothing is missing yet marks it incorrect', async () => {
    const client = stubClient({ ...grade, verdict: 'incorrect', missing: [] })

    await expect(
      gradeAnswer({ client, question, answer: 'It is a monoid.' }),
    ).rejects.toThrow(/verdict "incorrect" contradicts nothing being missing/)
  })
})
