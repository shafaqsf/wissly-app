// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  archiveArtefacts,
  createArtefact,
  generateArtefacts,
  moveArtefacts,
  requireUserId,
  rescheduleArtefacts,
  restoreArtefacts,
  revalidatePath,
  saveArtefacts,
  sectionsWithFormat,
  updateArtefact,
} = vi.hoisted(() => ({
  archiveArtefacts: vi.fn(async () => []),
  createArtefact: vi.fn(async () => ({ id: 'task-1' })),
  generateArtefacts: vi.fn(async () => ({ artefacts: [], failures: [] })),
  moveArtefacts: vi.fn(async () => []),
  requireUserId: vi.fn(async () => 'user-1'),
  rescheduleArtefacts: vi.fn(async () => []),
  restoreArtefacts: vi.fn(async () => []),
  revalidatePath: vi.fn(),
  saveArtefacts: vi.fn(async () => []),
  sectionsWithFormat: vi.fn(async () => []),
  updateArtefact: vi.fn(async () => ({ id: 'task-1' })),
}))

/* The sections a generation run reads. The action asks the database for them
 * by id; nothing else in this file touches a table directly. */
const sections = [
  { id: 'section-1', ordinal: 1, content: 'Eigenvectors keep their direction.', anchor: { page: 3 } },
  { id: 'section-2', ordinal: 2, content: 'The characteristic polynomial.', anchor: { page: 4 } },
]

const supabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      in: vi.fn(async () => ({ data: sections, error: null })),
    })),
  })),
}

vi.mock('@/lib/supabase/server.js', () => ({ createClient: vi.fn(async () => supabase) }))
vi.mock('@/lib/auth/user.js', () => ({ requireUserId }))
vi.mock('next/cache', () => ({ revalidatePath }))
vi.mock('@/lib/data/artefacts.js', () => ({
  archiveArtefacts,
  createArtefact,
  moveArtefacts,
  rescheduleArtefacts,
  restoreArtefacts,
  saveArtefacts,
  sectionsWithFormat,
  updateArtefact,
}))
vi.mock('@/lib/agent/artefacts.js', () => ({ generateArtefacts }))
vi.mock('@/lib/agent/openrouter.js', () => ({
  createOpenRouterClient: vi.fn(() => ({})),
  openRouterConfigFromEnv: vi.fn(() => ({})),
}))

import {
  archiveTasksAction,
  createTaskAction,
  generateTasksAction,
  moveTasksAction,
  rescheduleTasksAction,
  restoreTasksAction,
  sectionsWithFormatAction,
  updateTaskAction,
} from './task.js'

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.append(key, value)
  return data
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUserId.mockResolvedValue('user-1')
  createArtefact.mockResolvedValue({ id: 'task-1' })
})

describe('writing one by hand', () => {
  it('costs nothing and is recorded as the learner’s own', async () => {
    await createTaskAction(
      {},
      form({
        format: 'flashcard',
        subjectId: 'course-1',
        sectionId: 'section-1',
        front: 'What is an eigenvalue?',
        back: 'The factor a matrix scales an eigenvector by.',
      }),
    )

    expect(createArtefact).toHaveBeenCalledWith(supabase, {
      userId: 'user-1',
      subjectId: 'course-1',
      sectionId: 'section-1',
      conceptId: null,
      format: 'flashcard',
      payload: {
        front: 'What is an eigenvalue?',
        back: 'The factor a matrix scales an eigenvector by.',
      },
      origin: 'manual',
    })
  })

  it('builds a cloze out of the sentence and the word taken out of it', async () => {
    await createTaskAction(
      {},
      form({
        format: 'cloze',
        subjectId: 'course-1',
        text: 'A vector whose direction is kept is an ____.',
        answer: 'eigenvector',
      }),
    )

    expect(createArtefact).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        format: 'cloze',
        payload: { text: 'A vector whose direction is kept is an ____.', answer: 'eigenvector' },
      }),
    )
  })

  it('builds a multiple choice out of one right answer and three distractors', async () => {
    await createTaskAction(
      {},
      form({
        format: 'multiple_choice',
        subjectId: 'course-1',
        stem: 'What do the roots give you?',
        'option-0': 'The eigenvalues',
        'option-1': 'The eigenvectors',
        'option-2': 'The rank',
        'option-3': 'The trace',
        answer_index: '0',
        'rationale-0': 'Right.',
        'rationale-1': 'Scalars, not vectors.',
        'rationale-2': 'Does not depend on lambda.',
        'rationale-3': 'One number, not a set.',
      }),
    )

    expect(createArtefact).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        format: 'multiple_choice',
        payload: {
          stem: 'What do the roots give you?',
          options: ['The eigenvalues', 'The eigenvectors', 'The rank', 'The trace'],
          answer_index: 0,
          rationales: [
            'Right.',
            'Scalars, not vectors.',
            'Does not depend on lambda.',
            'One number, not a set.',
          ],
        },
      }),
    )
  })

  it('takes an open question with one criterion per line', async () => {
    await createTaskAction(
      {},
      form({
        format: 'open_question',
        subjectId: 'course-1',
        prompt: 'Explain what an eigenvector is.',
        model_answer: 'A non-zero vector whose direction the matrix keeps.',
        criteria: 'The direction is unchanged\nThe vector is non-zero\n',
      }),
    )

    expect(createArtefact).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        payload: expect.objectContaining({
          criteria: ['The direction is unchanged', 'The vector is non-zero'],
        }),
      }),
    )
  })

  it('says what is wrong with the card rather than storing an unusable one', async () => {
    const state = await createTaskAction(
      {},
      form({ format: 'cloze', subjectId: 'course-1', text: 'No blank here.', answer: 'x' }),
    )

    expect(state.message).toMatch(/blank/)
    expect(createArtefact).not.toHaveBeenCalled()
  })

  it('refuses a format that is read rather than answered', async () => {
    const state = await createTaskAction(
      {},
      form({ format: 'summary', subjectId: 'course-1' }),
    )

    expect(state).toEqual({ message: 'That is not a task type.' })
    expect(createArtefact).not.toHaveBeenCalled()
  })
})

describe('editing one', () => {
  it('writes the payload back against the row', async () => {
    await updateTaskAction(
      {},
      form({
        id: 'task-1',
        format: 'flashcard',
        front: 'What is an eigenvalue?',
        back: 'A scale factor.',
      }),
    )

    expect(updateArtefact).toHaveBeenCalledWith(supabase, {
      id: 'task-1',
      payload: { front: 'What is an eigenvalue?', back: 'A scale factor.' },
    })
  })
})

describe('acting on a selection', () => {
  it('archives every row that was selected, in one statement', async () => {
    await archiveTasksAction(form({ ids: 'task-1,task-2,task-3' }))

    expect(archiveArtefacts).toHaveBeenCalledWith(supabase, {
      ids: ['task-1', 'task-2', 'task-3'],
    })
  })

  it('restores a selection', async () => {
    await restoreTasksAction(form({ ids: 'task-1' }))

    expect(restoreArtefacts).toHaveBeenCalledWith(supabase, { ids: ['task-1'] })
  })

  it('moves a selection to another course', async () => {
    await moveTasksAction(form({ ids: 'task-1,task-2', subjectId: 'course-2' }))

    expect(moveArtefacts).toHaveBeenCalledWith(supabase, {
      ids: ['task-1', 'task-2'],
      subjectId: 'course-2',
    })
  })

  it('pushes a selection out to a date', async () => {
    await rescheduleTasksAction(form({ ids: 'task-1', dueAt: '2026-08-01' }))

    expect(rescheduleArtefacts).toHaveBeenCalledWith(supabase, {
      ids: ['task-1'],
      dueAt: '2026-08-01',
    })
  })

  it('does nothing at all when nothing was selected', async () => {
    await archiveTasksAction(form({ ids: '' }))

    expect(archiveArtefacts).not.toHaveBeenCalled()
  })
})

describe('duplicate protection', () => {
  it('reports which of the named sections already have this type', async () => {
    sectionsWithFormat.mockResolvedValue(['section-2'])

    const covered = await sectionsWithFormatAction({
      format: 'flashcard',
      sectionIds: ['section-1', 'section-2'],
    })

    expect(sectionsWithFormat).toHaveBeenCalledWith(supabase, {
      format: 'flashcard',
      sectionIds: ['section-1', 'section-2'],
    })
    expect(covered).toEqual(['section-2'])
  })
})

describe('generating from material', () => {
  it('spends one model call per section, on the type that was asked for', async () => {
    generateArtefacts.mockResolvedValue({
      artefacts: [{ format: 'flashcard', payload: {} }],
      failures: [],
    })

    const state = await generateTasksAction(
      {},
      form({ format: 'flashcard', subjectId: 'course-1', sectionIds: 'section-1,section-2' }),
    )

    expect(generateArtefacts).toHaveBeenCalledWith(
      expect.objectContaining({ sections, format: 'flashcard', collectFailures: true }),
    )
    expect(saveArtefacts).toHaveBeenCalledWith(supabase, {
      userId: 'user-1',
      artefacts: [expect.objectContaining({ format: 'flashcard', subject_id: 'course-1' })],
      origin: 'agent',
    })
    expect(state.message).toBe('Wrote 1 flashcard from 2 sections.')
    expect(state.done).toBe(true)
  })

  it('says which sections it could not write from, so they can be retried', async () => {
    generateArtefacts.mockResolvedValue({
      artefacts: [],
      failures: [{ section_id: 'section-1', error: 'too thin' }],
    })

    const state = await generateTasksAction(
      {},
      form({ format: 'flashcard', subjectId: 'course-1', sectionIds: 'section-1' }),
    )

    expect(state.message).toMatch(/1 section could not be written from/)
  })

  it('asks for a section rather than spending on the whole course', async () => {
    const state = await generateTasksAction(
      {},
      form({ format: 'flashcard', subjectId: 'course-1', sectionIds: '' }),
    )

    expect(state).toEqual({ message: 'Choose at least one section to generate from.' })
    expect(generateArtefacts).not.toHaveBeenCalled()
  })
})
