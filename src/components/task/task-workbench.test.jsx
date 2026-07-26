import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TaskWorkbench from './task-workbench'
import { typeBySlug } from './task-types'

const flashcards = typeBySlug('flashcards')

const sources = [
  {
    id: 'source-1',
    title: 'Lecture notes',
    sections: [
      { id: 'section-1', ordinal: 1 },
      { id: 'section-2', ordinal: 2 },
    ],
  },
  { id: 'source-2', title: 'Handout', sections: [{ id: 'section-3', ordinal: 3 }] },
]

const tasks = [
  card('task-1', 'section-1', 'Eigenvalue?'),
  card('task-2', 'section-2', 'Eigenvector?'),
  card('task-3', 'section-3', 'Rank?'),
]

function card(id, sectionId, front) {
  return {
    id,
    format: 'flashcard',
    section_id: sectionId,
    subject_id: 'course-1',
    section_ordinal: 1,
    anchor: { page: 1 },
    origin: 'manual',
    payload: { front, back: 'A number.' },
  }
}

const actions = {
  create: vi.fn(async () => ({ done: true })),
  update: vi.fn(async () => ({ done: true })),
  generate: vi.fn(async () => ({ done: true, message: 'Wrote 2 flashcards from 2 sections.' })),
  duplicates: vi.fn(async () => []),
  archive: vi.fn(async () => {}),
  restore: vi.fn(async () => {}),
  move: vi.fn(async () => {}),
  reschedule: vi.fn(async () => {}),
}

function workbench(props = {}) {
  return render(
    <TaskWorkbench
      type={flashcards}
      courseId="course-1"
      courseName="Optics"
      courses={[
        { id: 'course-1', title: 'Optics' },
        { id: 'course-2', title: 'Algebra' },
      ]}
      tasks={tasks}
      sources={sources}
      actions={actions}
      {...props}
    />,
  )
}

/* Pick one row of the table by the text on its front. The stack above shows
   the same words for the card it is turned to, so the row is the one of them
   that sits inside a list item. */
function row(front) {
  return screen
    .getAllByText(front)
    .map((node) => node.closest('li'))
    .find(Boolean)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('the workbench', () => {
  it('offers both ways in, and says which one costs nothing', () => {
    workbench()

    expect(screen.getByRole('button', { name: 'Write one' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate from material' })).toBeInTheDocument()
  })

  it('says what the next step is when there is nothing here yet', () => {
    workbench({ tasks: [] })

    expect(
      screen.getByText(
        'No flashcards yet. Write one yourself — it costs nothing — or generate a set from your material.',
      ),
    ).toBeInTheDocument()
  })

  /* task item 7 in v0.15: this is the first thing a new course meets, since
     nothing is generated on upload any more, so it carries an illustration
     beside the sentence. */
  it('draws an illustration beside the invitation to write the first one', () => {
    const { container } = workbench({ tasks: [] })

    expect(container.querySelector('svg[data-empty-illustration]')).toBeInTheDocument()
  })

  it('narrows the list to one source', async () => {
    const user = userEvent.setup()
    workbench()

    await user.selectOptions(screen.getByLabelText('Source'), 'source-2')

    expect(row('Rank?')).toBeTruthy()
    expect(screen.queryByText('Eigenvalue?')).not.toBeInTheDocument()
  })

  it('narrows further to one section of that source', async () => {
    const user = userEvent.setup()
    workbench()

    await user.selectOptions(screen.getByLabelText('Source'), 'source-1')
    await user.selectOptions(screen.getByLabelText('Section'), 'section-2')

    expect(row('Eigenvector?')).toBeTruthy()
    expect(screen.queryByText('Eigenvalue?')).not.toBeInTheDocument()
  })

  it('writes one by hand, with no model anywhere near it', async () => {
    const user = userEvent.setup()
    workbench()

    await user.click(screen.getByRole('button', { name: 'Write one' }))
    await user.type(screen.getByLabelText('The front'), 'What is the rank?')
    await user.type(screen.getByLabelText('The back'), 'The dimension of the image.')
    await user.click(screen.getByRole('button', { name: 'Save it' }))

    const sent = actions.create.mock.calls[0][1]
    expect(sent.get('front')).toBe('What is the rank?')
    expect(sent.get('back')).toBe('The dimension of the image.')
    expect(sent.get('format')).toBe('flashcard')
    expect(sent.get('subjectId')).toBe('course-1')
    expect(actions.generate).not.toHaveBeenCalled()
  })

  it('edits one in place, against the row it belongs to', async () => {
    const user = userEvent.setup()
    workbench()

    await user.click(within(row('Eigenvalue?')).getByRole('button', { name: 'Edit' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(actions.update.mock.calls[0][1].get('id')).toBe('task-1')
  })

  it('never says "artefact" to the learner', () => {
    const { container } = workbench()

    expect(container.textContent.toLowerCase()).not.toContain('artefact')
  })
})

/* The whole point of holding the selection above the filter. */
describe('a selection outlives a filter change', () => {
  it('keeps rows that the filter has taken off the screen', async () => {
    const user = userEvent.setup()
    workbench()

    await user.click(within(row('Eigenvalue?')).getByLabelText('Select this one'))
    await user.click(within(row('Rank?')).getByLabelText('Select this one'))
    expect(screen.getByText(/2 selected/)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Source'), 'source-2')

    expect(screen.queryByText('Eigenvalue?')).not.toBeInTheDocument()
    expect(screen.getByText(/2 selected/)).toBeInTheDocument()
  })

  it('says how many of them the filter is hiding, before anything acts on them', async () => {
    const user = userEvent.setup()
    workbench()

    await user.click(within(row('Eigenvalue?')).getByLabelText('Select this one'))
    await user.selectOptions(screen.getByLabelText('Source'), 'source-2')

    expect(screen.getByText('(1 not shown under this filter)')).toBeInTheDocument()
  })

  it('archives every selected row in one go, hidden ones included', async () => {
    const user = userEvent.setup()
    workbench()

    await user.click(within(row('Eigenvalue?')).getByLabelText('Select this one'))
    await user.click(within(row('Rank?')).getByLabelText('Select this one'))
    await user.selectOptions(screen.getByLabelText('Source'), 'source-2')
    await user.click(screen.getByRole('button', { name: 'Archive' }))

    expect(actions.archive).toHaveBeenCalledTimes(1)
    expect(actions.archive.mock.calls[0][0].get('ids')).toBe('task-1,task-3')
  })

  it('moves a selection to another course', async () => {
    const user = userEvent.setup()
    workbench()

    await user.click(within(row('Eigenvalue?')).getByLabelText('Select this one'))
    await user.click(screen.getByRole('button', { name: 'Move to another course' }))
    await user.selectOptions(screen.getByLabelText('The course to move them to'), 'course-2')
    await user.click(screen.getByRole('button', { name: 'Move them' }))

    expect(actions.move.mock.calls[0][0].get('subjectId')).toBe('course-2')
    expect(actions.move.mock.calls[0][0].get('ids')).toBe('task-1')
  })

  it('offers nothing to do until something is selected', () => {
    workbench()

    expect(
      screen.queryByRole('region', { name: 'What to do with the selection' }),
    ).not.toBeInTheDocument()
  })

  it('selects every row the filter is showing at once', async () => {
    const user = userEvent.setup()
    workbench()

    await user.selectOptions(screen.getByLabelText('Source'), 'source-1')
    await user.click(screen.getByLabelText('Select all shown'))

    expect(screen.getByText(/2 selected/)).toBeInTheDocument()
  })
})

describe('generating from material', () => {
  it('shows the number of model calls before the click', async () => {
    const user = userEvent.setup()
    workbench()

    await user.click(screen.getByRole('button', { name: 'Generate from material' }))
    expect(screen.getByText('Nothing chosen yet. Each section costs one model call.')).toBeInTheDocument()

    await user.click(screen.getByLabelText(/Section 1/, { selector: 'input' }))
    expect(screen.getByText('1 section chosen — 1 model call.')).toBeInTheDocument()

    await user.click(screen.getByLabelText(/Section 3/, { selector: 'input' }))
    expect(screen.getByText('2 sections chosen — 2 model calls.')).toBeInTheDocument()
  })

  it('warns which of the chosen sections already have this type', async () => {
    actions.duplicates.mockResolvedValue(['section-1'])
    const user = userEvent.setup()
    workbench()

    await user.click(screen.getByRole('button', { name: 'Generate from material' }))
    await user.click(screen.getByLabelText(/Section 1/, { selector: 'input' }))

    expect(await screen.findByRole('status')).toHaveTextContent(
      'One of the sections you chose already has this type. Generating again writes a second one.',
    )
    expect(actions.duplicates).toHaveBeenCalledWith({
      format: 'flashcard',
      sectionIds: ['section-1'],
    })
  })

  it('will not spend anything until a section is chosen', async () => {
    const user = userEvent.setup()
    workbench()

    await user.click(screen.getByRole('button', { name: 'Generate from material' }))

    expect(screen.getByRole('button', { name: 'Generate flashcards' })).toBeDisabled()
  })
})

describe('the flashcard surface', () => {
  it('is a stack to practise with and a table to tidy in', () => {
    workbench()

    expect(screen.getByRole('region', { name: 'Practice' })).toBeInTheDocument()
    expect(screen.getByRole('list')).toBeInTheDocument()
  })

  it('turns the card in three dimensions rather than swapping its face', async () => {
    const user = userEvent.setup()
    workbench()

    const card = screen.getByTestId('flashcard')
    expect(card).toHaveClass('motion-flip')
    expect(card).toHaveAttribute('data-turned', 'false')

    await user.click(screen.getByRole('button', { name: 'Turn the card' }))

    expect(screen.getByTestId('flashcard')).toHaveAttribute('data-turned', 'true')
  })

  it('carries both faces, and hides the one facing away from the reader', () => {
    workbench()

    const back = screen.getByTestId('flashcard').querySelector('[data-face="back"]')

    expect(back).toHaveClass('motion-flip-face')
    expect(back).toHaveAttribute('aria-hidden', 'true')
  })

  it('offers the two exports a learner can actually open', () => {
    workbench()

    expect(screen.getByRole('button', { name: 'Export as CSV' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export for Anki' })).toBeInTheDocument()
  })
})

describe('the archive', () => {
  it('restores rather than archives, and offers no way to generate more', () => {
    workbench({ archived: true })

    expect(screen.queryByRole('button', { name: 'Generate from material' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Practice' })).not.toBeInTheDocument()
  })

  it('puts a selection back', async () => {
    const user = userEvent.setup()
    workbench({ archived: true })

    await user.click(within(row('Eigenvalue?')).getByLabelText('Select this one'))
    await user.click(screen.getByRole('button', { name: 'Restore' }))

    expect(actions.restore).toHaveBeenCalledTimes(1)
    expect(actions.archive).not.toHaveBeenCalled()
  })
})
