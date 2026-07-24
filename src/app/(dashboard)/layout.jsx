import { redirect } from 'next/navigation';

import DashboardShell from '@/components/shell/dashboard-shell';
import { createClient } from '@/lib/supabase/server.js';

/* The route group keeps `/dashboard` out of a nested URL segment while every
   page inside it shares one frame. `/` is a junction that redirects here.

   Signing out is not part of the frame. It is an account action, it lives on
   the settings page, and under every page's content it would appear twice on
   that one. */
export default async function DashboardLayout({ children }) {
  // The proxy already turned a signed-out visitor away, but that check is
  // optimistic — it reads a cookie before the request reaches this tree.
  // This is the one that decides. `getClaims` verifies the signature;
  // `getSession` would only echo the cookie back.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    redirect('/sign-in');
  }

  return <DashboardShell>{children}</DashboardShell>;
}
