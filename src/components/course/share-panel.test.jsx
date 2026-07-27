import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import SharePanel from './share-panel'

const noop = () => ({})

const shares = [
  { id: 'sh-1', shared_with_user_id: 'user-2', invitee_email: 'friend@example.com' },
]

describe('the share panel', () => {
  it('says a course has not been shared with anyone yet', () => {
    render(<SharePanel courseId="course-1" shares={[]} shareAction={noop} revokeAction={noop} />)

    expect(screen.getByText(/not shared with anyone yet/i)).toBeInTheDocument()
  })

  it('lists who a course has been shared with, and a way to stop', () => {
    render(
      <SharePanel courseId="course-1" shares={shares} shareAction={noop} revokeAction={noop} />,
    )

    expect(screen.getByText('friend@example.com')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Stop sharing with friend@example.com' }),
    ).toBeInTheDocument()
  })

  it('offers an email field to share with someone new', () => {
    render(<SharePanel courseId="course-1" shares={[]} shareAction={noop} revokeAction={noop} />)

    expect(screen.getByLabelText(/share with/i)).toHaveAttribute('type', 'email')
    expect(screen.getByRole('button', { name: 'Share course' })).toBeInTheDocument()
  })

  it('shows what the server said when sharing fails', () => {
    render(
      <SharePanel
        courseId="course-1"
        shares={[]}
        shareAction={noop}
        revokeAction={noop}
        initialState={{ message: 'No wissly account uses that email.' }}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('No wissly account uses that email.')
  })

  it('access is read-only — there is no level to choose', () => {
    render(
      <SharePanel courseId="course-1" shares={shares} shareAction={noop} revokeAction={noop} />,
    )

    expect(screen.queryByRole('combobox')).toBeNull()
  })
})
