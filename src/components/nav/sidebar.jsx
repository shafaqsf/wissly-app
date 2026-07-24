'use client';

import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import NavItem from './nav-item';
import { navItems } from './nav-items';

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
        className={[
          'flex min-h-16 items-center gap-2 border-b border-rule px-3',
          collapsed ? 'md:justify-center' : 'justify-between',
        ].join(' ')}
      >
        <Link
          href="/dashboard"
          className={[
            'font-display text-title font-semibold lowercase',
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
