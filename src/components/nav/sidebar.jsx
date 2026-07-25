'use client';

import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import NavItem from './nav-item';
import { navItems } from './nav-items';
import BrandMark from '@/components/brand/brand-mark';

/* The sidebar holds no state of its own. Collapsing and the small-screen
   overlay are owned by the shell, so both can be reasoned about in one place. */
export default function Sidebar({
  collapsed = false,
  onToggleCollapse,
  mobileOpen = false,
  onCloseMobile,
}) {
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
          // A 64px rail minus its padding leaves 40px, and a 24px mark beside
          // a 44px tap target needs 68px. Side by side they overflowed the
          // rail: the mark fell off the left edge of the screen and the toggle
          // sat out over the page, so the rail could not be opened again.
          // Collapsed the row becomes a column and gives up its side padding,
          // which leaves each of the two the full width of the rail.
          collapsed
            ? 'md:flex-col md:justify-center md:gap-1 md:px-0 md:py-2'
            : 'justify-between',
        ].join(' ')}
      >
        {/* The mark stays when the word goes: a 64px rail has room for one of
            the two, and the mark is the half that survives being small. */}
        <BrandMark size={24} />

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
            collapsed={collapsed && !mobileOpen}
          />
        ))}
      </nav>
    </div>
  );
}
