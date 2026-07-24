import { redirect } from 'next/navigation'

/* Who is asking. `getClaims` verifies the token signature; `getSession` only
 * reads the cookie back and would trust whatever the browser sent.
 *
 * Every write in this app stamps the row with this id, and row level security
 * checks it again in the database. The check here is not the security — it is
 * so a signed-out visitor gets the sign-in screen instead of an error. */

export async function currentUserId(supabase) {
  const { data } = await supabase.auth.getClaims()
  return data?.claims?.sub ?? null
}

export async function requireUserId(supabase) {
  const id = await currentUserId(supabase)

  if (!id) {
    redirect('/sign-in')
  }

  return id
}
