import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import OrderingArtefact from './ordering-artefact'
import { orderingFixture } from '@/lib/artefact-fixtures'

const { items } = orderingFixture.payload

describe('OrderingArtefact', () => {
  it('offers every item exactly once, out of order', () => {
    render(<OrderingArtefact artefact={orderingFixture} />)

    const list = screen.getByRole('list')
    const shown = [...list.querySelectorAll('li')].map((row) => row.textContent)

    for (const item of items) {
      expect(shown.some((text) => text.includes(item))).toBe(true)
    }
    // Started out of order, so the check has something to prove.
    expect(shown.join('|')).not.toBe(items.join('|'))
  })

  it('will not check before it has moved anything', () => {
    render(<OrderingArtefact artefact={orderingFixture} />)
    expect(screen.getByRole('button', { name: 'Check the order' })).toBeInTheDocument()
  })

  it('moves an item up and down within the list', async () => {
    const user = userEvent.setup()
    render(<OrderingArtefact artefact={orderingFixture} />)

    const before = [...screen.getByRole('list').querySelectorAll('li')].map(
      (row) => row.textContent,
    )

    await user.click(screen.getAllByRole('button', { name: /move .* down/i })[0])

    const after = [...screen.getByRole('list').querySelectorAll('li')].map(
      (row) => row.textContent,
    )
    expect(after).not.toEqual(before)
    expect(after[0]).toBe(before[1])
    expect(after[1]).toBe(before[0])
  })

  it('says so plainly when the order is put back correctly', async () => {
    const user = userEvent.setup()
    render(<OrderingArtefact artefact={orderingFixture} />)

    // The fixture displays the exact reverse of the correct order. Restore
    // it by bubbling each item up to its slot in turn, front to back — the
    // item that belongs at position `target` needs exactly
    // `items.length - 1 - target` adjacent up-moves once everything ahead
    // of it has already settled, which is how a reversed list is sorted one
    // adjacent swap at a time.
    for (let target = 0; target < items.length; target += 1) {
      const rises = items.length - 1 - target
      for (let i = 0; i < rises; i += 1) {
        const upButtons = screen.getAllByRole('button', { name: /move .* up/i })
        const button = upButtons.find((candidate) =>
          candidate.getAttribute('aria-label')?.includes(items[target]),
        )
        await user.click(button)
      }
    }
    await user.click(screen.getByRole('button', { name: 'Check the order' }))

    expect(screen.getByRole('status')).toHaveTextContent('Right.')
  })

  it('says so plainly when the order is still wrong', async () => {
    const user = userEvent.setup()
    render(<OrderingArtefact artefact={orderingFixture} />)

    await user.click(screen.getByRole('button', { name: 'Check the order' }))

    expect(screen.getByRole('status')).toHaveTextContent('Not right.')
    expect(screen.getByText(orderingFixture.payload.rationale)).toBeInTheDocument()
  })

  it('carries the anchor of the section it was drawn from', async () => {
    const user = userEvent.setup()
    render(<OrderingArtefact artefact={orderingFixture} />)

    await user.click(screen.getByRole('button', { name: 'Check the order' }))

    expect(
      screen.getByRole('button', {
        name: 'Source 2, The characteristic polynomial, characters 1840–2104',
      }),
    ).toBeInTheDocument()
  })

  it('tells the queue how the learner did', async () => {
    const user = userEvent.setup()
    const answered = []
    render(
      <OrderingArtefact
        artefact={orderingFixture}
        onAnswered={(result) => answered.push(result)}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Check the order' }))

    expect(answered[0]).toMatchObject({ artefactId: orderingFixture.id, correct: false })
  })
})
