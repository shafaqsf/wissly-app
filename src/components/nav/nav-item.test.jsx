import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NavItem from './nav-item'
import { BookOpen } from 'lucide-react'

const { usePathname } = vi.hoisted(() => ({ usePathname: vi.fn() }))

vi.mock('next/navigation', () => ({ usePathname }))

describe('NavItem', () => {
  beforeEach(() => {
    usePathname.mockReturnValue('/dashboard')
  })

  it('links to its destination and names itself', () => {
    render(<NavItem href="/courses" label="Courses" icon={BookOpen} />)

    const link = screen.getByRole('link', { name: 'Courses' })
    expect(link).toHaveAttribute('href', '/courses')
  })

  it('marks the current route for assistive technology', () => {
    render(<NavItem href="/dashboard" label="Dashboard" icon={BookOpen} />)

    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page')
  })

  it('treats a nested route as being inside its section', () => {
    usePathname.mockReturnValue('/courses/algebra')
    render(<NavItem href="/courses" label="Courses" icon={BookOpen} />)

    expect(screen.getByRole('link')).toHaveAttribute('aria-current', 'page')
  })

  it('does not match a sibling route that merely shares a prefix', () => {
    usePathname.mockReturnValue('/courses-archive')
    render(<NavItem href="/courses" label="Courses" icon={BookOpen} />)

    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current')
  })

  it('keeps an accessible name when collapsed to an icon', () => {
    render(<NavItem href="/courses" label="Courses" icon={BookOpen} collapsed />)

    expect(screen.getByRole('link', { name: 'Courses' })).toBeInTheDocument()
  })
})
