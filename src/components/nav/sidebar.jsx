'use client';

import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import NavItem from './nav-item';
import { accountItem, navItems } from './nav-items';

/* The sidebar holds no state of its own. Collapsing and the small-screen
   overlay are owned by the shell, so both can be reasoned about in one place.

   No brand mark here, and this is deliberate: the product names itself once
   per viewport, and the agent bar is that one place — see docs/DESIGN.md,
   "The mark". A second mark in the rail would be the repetition the document
   forbids, so do not add one back. What makes the collapsed rail
   recognisable is the nav itself: four named destinations, each keeping its
   name on hover and to a screen reader at 64px, with the current one filled. */
export default function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}) {
  const railCollapsed = collapsed && !mobileOpen;

  return (
    <div
      className={[
        'flex h-full flex-col border-rule bg-paper md:border-r',
        collapsed ? 'md:w-16' : 'md:w-60',
        'w-72 max-w-full',
      ].join(' ')}
    >
      <div
        data-brand-row=""
        className={[
          'flex min-h-16 items-center gap-2 border-b border-rule px-3',
          // A 64px rail minus its padding leaves 40px, and the toggle is a
          // 44px tap target. Collapsed the row gives up its side padding and
          // centres the one control it still holds, so the rail can always be
          // opened again.
          collapsed
            ? 'md:justify-center md:gap-1 md:px-0'
            : 'justify-between',
        ].join(' ')}
      >
        <Link
          href="/dashboard"
          // Rounded for the focus ring: an outline follows the element's own
          // corner, so a control with no radius draws a square one.
          className={[
            'mr-auto rounded-control px-1 font-display text-title font-semibold lowercase',
            collapsed ? 'md:sr-only' : '',
          ].join(' ')}
        >
          wissly
        </Link>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden size-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:text-ink md:flex"
        >
          {collapsed ? (
            <PanelLeftOpen size={20} strokeWidth={1.5} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={20} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>

        {mobileOpen ? (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation"
            className="flex size-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:text-ink md:hidden"
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <nav aria-label="Main" className="flex flex-col gap-1 p-3">
        {navItems.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            collapsed={railCollapsed}
          />
        ))}
      </nav>

      {/* The account, not a fifth area. It sits at the foot behind a hairline
          so the list above stays four things long, and it keeps its 44px tap
          target whether the rail is open or 64px wide. */}
      <nav
        aria-label="Account"
        className="mt-auto flex flex-col border-t border-rule p-3"
      >
        <NavItem
          href={accountItem.href}
          label={accountItem.label}
          icon={accountItem.icon}
          collapsed={railCollapsed}
        />
      </nav>
    </div>
  );
}
