'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import Panel from '@/components/panel/panel';
import { markAllNotificationsReadAction, markNotificationReadAction } from '@/lib/actions/notifications.js';

/* The bell holds its own copy of the list so a click reads as instant rather
   than waiting on a round trip and a layout refresh. The server action still
   runs — it is the truth the next full load reads back — but the interface
   does not make the learner wait for it.

   No colour marks "unread": hue is reserved for the grain field and
   the mark, and neither belongs to a notification's read state. An unread
   row keeps a plain ink dot and its bold title; a read one loses both. */

const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const MINUTE_MS = 60 * 1000;
const UNITS = [
  ['year', 365 * 24 * 60 * MINUTE_MS],
  ['month', 30 * 24 * 60 * MINUTE_MS],
  ['week', 7 * 24 * 60 * MINUTE_MS],
  ['day', 24 * 60 * MINUTE_MS],
  ['hour', 60 * MINUTE_MS],
  ['minute', MINUTE_MS],
];

function relativeTime(iso, now = Date.now()) {
  const diff = new Date(iso).getTime() - now;

  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) {
      return RELATIVE.format(Math.round(diff / ms), unit);
    }
  }

  return RELATIVE.format(0, 'minute');
}

export default function NotificationBell({ initialNotifications = [], initialUnreadCount = 0 }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const containerRef = useRef(null);

  // The server re-fetches these on every navigation and this component does
  // not remount (the bell lives in a persistent layout), so a fresh prop pair
  // must overwrite the client's optimistic copy. Setting state mid-render
  // rather than in an effect avoids the extra commit an effect would cause —
  // see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [priorNotifications, setPriorNotifications] = useState(initialNotifications);
  if (priorNotifications !== initialNotifications) {
    setPriorNotifications(initialNotifications);
    setNotifications(initialNotifications);
    setUnreadCount(initialUnreadCount);
  }

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    function onPointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  function markOneRead(id) {
    setNotifications((list) =>
      list.map((item) => (item.id === id && !item.read_at ? { ...item, read_at: new Date().toISOString() } : item)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    const formData = new FormData();
    formData.append('id', id);
    markNotificationReadAction(formData);
  }

  function markEveryoneRead() {
    setNotifications((list) => list.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })));
    setUnreadCount(0);
    markAllNotificationsReadAction();
  }

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={label}
        className="relative flex size-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:text-ink"
      >
        <Bell size={20} strokeWidth={1.5} aria-hidden="true" />
        {unreadCount > 0 ? (
          <span
            aria-hidden="true"
            className="motion-count absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-round bg-ink px-1 font-mono text-[10px] leading-none text-paper"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="motion-slide absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)]">
          <Panel
            title="Notifications"
            action={
              unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={markEveryoneRead}
                  className="rounded-control px-2 py-1 font-mono text-label text-ink-muted hover:text-ink"
                >
                  Mark all read
                </button>
              ) : null
            }
            empty={
              notifications.length === 0
                ? 'Nothing yet. Reminders about your queue land here.'
                : undefined
            }
          >
            <ul className="-mx-5 -my-5 max-h-96 divide-y divide-rule overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => markOneRead(notification.id)}
                    className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-paper-sunk"
                  >
                    <span className="flex items-center gap-2">
                      {notification.read_at ? null : (
                        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-round bg-ink" />
                      )}
                      <span
                        className={
                          notification.read_at ? 'text-body-s text-ink-muted' : 'text-body-s font-semibold text-ink'
                        }
                      >
                        {notification.title}
                      </span>
                      {notification.read_at ? null : <span className="sr-only">Unread</span>}
                    </span>
                    <span className="text-body-s text-ink-muted">{notification.body}</span>
                    <span className="font-mono text-caption text-ink-faint">
                      {relativeTime(notification.created_at)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
