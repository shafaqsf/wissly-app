import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { markAllNotificationsReadAction, markNotificationReadAction } = vi.hoisted(() => ({
  markAllNotificationsReadAction: vi.fn(async () => {}),
  markNotificationReadAction: vi.fn(async () => {}),
}))

vi.mock('@/lib/actions/notifications.js', () => ({
  markAllNotificationsReadAction,
  markNotificationReadAction,
}))

import NotificationBell from './notification-bell'

const NOTIFICATIONS = [
  {
    id: 'n1',
    kind: 'review_due',
    title: '8 reviews are due',
    body: 'A few minutes now keeps them from slipping further.',
    created_at: '2026-07-26T09:00:00.000Z',
    read_at: null,
  },
  {
    id: 'n2',
    kind: 'review_due',
    title: '3 reviews are due',
    body: 'Recall has faded on 3 cards.',
    created_at: '2026-07-20T09:00:00.000Z',
    read_at: '2026-07-20T10:00:00.000Z',
  },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NotificationBell', () => {
  it('names itself and its unread count for anyone not looking at the badge', () => {
    render(<NotificationBell initialNotifications={NOTIFICATIONS} initialUnreadCount={1} />)

    expect(screen.getByRole('button', { name: /notifications.*1 unread/i })).toBeInTheDocument()
  })

  it('says just "Notifications" once nothing is unread', () => {
    render(<NotificationBell initialNotifications={[]} initialUnreadCount={0} />)

    expect(screen.getByRole('button', { name: /^notifications$/i })).toBeInTheDocument()
  })

  it('opens the list on click and closes it on a second click', async () => {
    const user = userEvent.setup()
    render(<NotificationBell initialNotifications={NOTIFICATIONS} initialUnreadCount={1} />)

    const toggle = screen.getByRole('button', { name: /notifications/i })
    await user.click(toggle)

    const panel = screen.getByRole('region', { name: 'Notifications' })
    expect(within(panel).getByText('8 reviews are due')).toBeInTheDocument()
    expect(within(panel).getByText('3 reviews are due')).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const user = userEvent.setup()
    render(<NotificationBell initialNotifications={NOTIFICATIONS} initialUnreadCount={1} />)

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByRole('region', { name: 'Notifications' })).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument()
  })

  it('invites the reader to act when there is nothing to see', async () => {
    const user = userEvent.setup()
    render(<NotificationBell initialNotifications={[]} initialUnreadCount={0} />)

    await user.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.queryByText(/reviews are due/i)).not.toBeInTheDocument()
    expect(screen.getByText(/land here/i)).toBeInTheDocument()
  })

  it('marks a notification read, in the interface immediately and on the server', async () => {
    const user = userEvent.setup()
    render(<NotificationBell initialNotifications={NOTIFICATIONS} initialUnreadCount={1} />)

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await user.click(screen.getByRole('button', { name: /8 reviews are due/i }))

    expect(markNotificationReadAction).toHaveBeenCalledTimes(1)
    const [formData] = markNotificationReadAction.mock.calls[0]
    expect(formData.get('id')).toBe('n1')

    // The badge on the closed bell reflects it without a reload.
    await user.keyboard('{Escape}')
    expect(screen.getByRole('button', { name: /^notifications$/i })).toBeInTheDocument()
  })

  it('offers to mark everything read only when something is unread', async () => {
    const user = userEvent.setup()
    const { rerender } = render(
      <NotificationBell initialNotifications={NOTIFICATIONS} initialUnreadCount={1} />,
    )

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeInTheDocument()

    rerender(<NotificationBell initialNotifications={[]} initialUnreadCount={0} />)
    expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument()
  })

  it('marks everything read at once', async () => {
    const user = userEvent.setup()
    render(<NotificationBell initialNotifications={NOTIFICATIONS} initialUnreadCount={1} />)

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await user.click(screen.getByRole('button', { name: 'Mark all read' }))

    expect(markAllNotificationsReadAction).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: /^notifications$/i })).toBeInTheDocument()
  })

  it('never carries a status colour, unread or not', () => {
    render(<NotificationBell initialNotifications={NOTIFICATIONS} initialUnreadCount={1} />)

    document.querySelectorAll('[class]').forEach((node) => {
      String(node.getAttribute('class'))
        .split(' ')
        .filter(Boolean)
        .forEach((cls) => {
          expect(cls).not.toMatch(/-(red|green|amber|blue|yellow)-/)
        })
    })
  })
})
