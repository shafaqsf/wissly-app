import {
  BookOpen,
  LayoutDashboard,
  ListChecks,
  Settings,
  TrendingUp,
} from 'lucide-react';

/* The four areas, each answering one question no other one answers: what do I
   have, what can I do, how is it going. Named the way a learner would name
   them — "course", "task" — never after the table they read from.

   `Review` is `/tasks/due` now and `Library` dissolved into the course page;
   both old addresses are redirected in `next.config.mjs`. */
export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/tasks', label: 'Tasks', icon: ListChecks },
  { href: '/analytics', label: 'Analytics', icon: TrendingUp },
];

/* Settings is the account, not a fifth area, so it is not in the list above.
   It renders in the sidebar foot, under a hairline. */
export const accountItem = {
  href: '/settings',
  label: 'Settings',
  icon: Settings,
};
