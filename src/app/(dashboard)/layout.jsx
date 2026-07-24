import DashboardShell from '@/components/shell/dashboard-shell';

/* The route group keeps `/dashboard` out of a nested URL segment while every
   page inside it shares one frame. The landing page at `/` is untouched. */
export default function DashboardLayout({ children }) {
  return <DashboardShell>{children}</DashboardShell>;
}
