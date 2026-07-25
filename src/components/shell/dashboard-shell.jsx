'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import Sidebar from '@/components/nav/sidebar';

/* The dashboard frame: navigation on the left, page content on the right.
   One sidebar element serves both layouts — below 768px it slides in over the
   content, above it sits in the flow. Rendering it twice would duplicate every
   link in the accessibility tree. */
export default function DashboardShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [lastPathname, setLastPathname] = useState(pathname);

  // Following a link on a small screen should not leave the overlay standing
  // in front of the page the learner just asked for. Adjusted during render
  // rather than in an effect, so the overlay never paints on the new route.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    if (!mobileOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen]);

  return (
    <div className="flex min-h-full flex-1">
      {mobileOpen ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 cursor-default bg-ink/20 md:hidden"
        />
      ) : null}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 transition-transform duration-[120ms] ease-out',
          'md:static md:visible md:translate-x-0',
          mobileOpen ? 'translate-x-0' : 'invisible -translate-x-full',
        ].join(' ')}
      >
        <Sidebar
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center gap-3 border-b border-rule px-4 md:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="flex size-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:text-ink"
          >
            <Menu size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <span className="font-display text-title font-semibold lowercase">
            wissly
          </span>
        </header>

        {/* The bottom padding is the agent bar's room. It floats over this
            content, and a page whose last line sits under it is a page with a
            line the learner cannot read. */}
        <main className="flex-1 px-6 pt-8 pb-32 md:px-12 md:pt-12">{children}</main>
      </div>
    </div>
  );
}
