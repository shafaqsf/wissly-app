import { redirect } from 'next/navigation';

import SignOutButton from '@/components/auth/sign-out-button';
import DashboardShell from '@/components/shell/dashboard-shell';
import { createClient } from '@/lib/supabase/server.js';

/* The route group keeps `/dashboard` out of a nested URL segment while every
   page inside it shares one frame. `/` is a junction that redirects here. */
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

  return (
    <DashboardShell>
      {children}
      <div className="border-rule mt-12 border-t pt-6">
        <SignOutButton />
      </div>
    </DashboardShell>
  );
}
