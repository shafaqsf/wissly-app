import {
  BookOpen,
  Layers,
  LayoutDashboard,
  Library,
  Settings,
  TrendingUp,
} from 'lucide-react';

/* The sidebar's destinations. Named the way a learner would name them —
   "course", "progress" — never after the table they read from. */
export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/courses', label: 'Courses', icon: BookOpen },
  { href: '/review', label: 'Review', icon: Layers },
  { href: '/library', label: 'Library', icon: Library },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/settings', label: 'Settings', icon: Settings },
];
