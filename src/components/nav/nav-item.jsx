'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* A single destination in the sidebar. Collapsed it keeps its accessible
   name — the label moves off screen, it does not disappear.

   The current destination wears the accent now, beside `--paper-sunk`, which stays so the row is still
   legible to anyone who cannot tell the accent from ink. */
export default function NavItem({ href, label, icon: Icon, collapsed = false }) {
  const pathname = usePathname() ?? '';
  const current = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={[
        'flex min-h-11 items-center gap-3 rounded-control px-3',
        'font-mono text-label uppercase transition-colors duration-[120ms] ease-out',
        collapsed ? 'justify-center' : '',
        current ? 'bg-paper-sunk text-accent' : 'text-ink-muted hover:text-ink',
      ].join(' ')}
    >
      <Icon
        size={20}
        strokeWidth={1.5}
        aria-hidden="true"
        className="shrink-0"
      />
      <span className={collapsed ? 'sr-only' : ''}>{label}</span>
    </Link>
  );
}
