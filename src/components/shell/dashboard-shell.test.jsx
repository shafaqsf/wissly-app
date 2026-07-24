import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DashboardShell from './dashboard-shell'

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }))

vi.mock('next/navigation', () => ({ usePathname }))

describe('DashboardShell', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/dashboard')
  })

  it('renders the page content in the single main landmark', () => {
    render(
      <DashboardShell>
        <p>Panel content</p>
      </DashboardShell>,
    )

    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('main')).toHaveTextContent('Panel content')
  })

  it('names its navigation landmark', () => {
    render(<DashboardShell>content</DashboardShell>)

    expect(
      screen.getByRole('navigation', { name: /main/i }),
    ).toBeInTheDocument()
  })

  it('collapses the sidebar to icons and back', async () => {
    const user = userEvent.setup()
    render(<DashboardShell>content</DashboardShell>)

    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))

    expect(
      screen.getByRole('button', { name: /expand sidebar/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /expand sidebar/i }))

    expect(
      screen.getByRole('button', { name: /collapse sidebar/i }),
    ).toBeInTheDocument()
  })

  it('keeps every navigation destination reachable while collapsed', async () => {
    const user = userEvent.setup()
    render(<DashboardShell>content</DashboardShell>)

    const before = screen.getAllByRole('link').length
    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))

    expect(screen.getAllByRole('link')).toHaveLength(before)
  })

  it('opens the navigation on small screens and closes it again', async () => {
    const user = userEvent.setup()
    render(<DashboardShell>content</DashboardShell>)

    await user.click(screen.getByRole('button', { name: /open navigation/i }))
    expect(
      screen.getByRole('button', { name: /close navigation/i }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /close navigation/i }))
    expect(
      screen.queryByRole('button', { name: /close navigation/i }),
    ).not.toBeInTheDocument()
  })

  it('closes the open navigation on Escape', async () => {
    const user = userEvent.setup()
    render(<DashboardShell>content</DashboardShell>)

    await user.click(screen.getByRole('button', { name: /open navigation/i }))
    await user.keyboard('{Escape}')

    expect(
      screen.queryByRole('button', { name: /close navigation/i }),
    ).not.toBeInTheDocument()
  })

  it('closes the open navigation when the route changes', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<DashboardShell>content</DashboardShell>)

    await user.click(screen.getByRole('button', { name: /open navigation/i }))

    usePathname.mockReturnValue('/courses')
    rerender(<DashboardShell>content</DashboardShell>)

    expect(
      screen.queryByRole('button', { name: /close navigation/i }),
    ).not.toBeInTheDocument()
  })
})
