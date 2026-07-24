import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server.js';

/* `/` is a junction, not a page. A learner opening wissly wants the thing
   they came for — their dashboard, or the sign-in that leads to it. What the
   platform is belongs in the README, not in the way. */
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  redirect(data?.claims?.sub ? '/dashboard' : '/sign-in');
}
