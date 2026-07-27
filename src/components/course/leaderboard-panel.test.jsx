import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import LeaderboardPanel from './leaderboard-panel'

const rows = [
  { memberId: 'user-2', reviewsThisWeek: 9, rank: 1 },
  { memberId: 'user-1', reviewsThisWeek: 3, rank: 2 },
]

describe('the leaderboard', () => {
  it('ranks members by reviews completed this week', () => {
    render(<LeaderboardPanel rows={rows} currentUserId="user-1" />)

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('1')
    expect(items[0]).toHaveTextContent('9')
    expect(items[1]).toHaveTextContent('2')
    expect(items[1]).toHaveTextContent('3')
  })

  it('says which row is you, in words, not just by position', () => {
    render(<LeaderboardPanel rows={rows} currentUserId="user-1" />)

    expect(screen.getByText('You')).toBeInTheDocument()
  })

  it('is a real count, not a mark — leaderboard numbers are the one exception to mastery having none', () => {
    render(<LeaderboardPanel rows={rows} currentUserId="user-1" />)

    expect(screen.getByText('9 reviews')).toBeInTheDocument()
    expect(screen.getByText('3 reviews')).toBeInTheDocument()
  })

  it('shows a fellow member by a stable, non-identifying label', () => {
    render(<LeaderboardPanel rows={rows} currentUserId="user-1" />)

    // No email, no name — the leaderboard has no display-name source of its
    // own, and it does not go fetch one. A short id fragment is enough to
    // tell rows apart without exposing anything new.
    expect(screen.queryByText('user-2')).toBeNull()
  })
})
