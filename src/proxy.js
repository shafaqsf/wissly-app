import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

import { requireEnv } from '@/lib/supabase/env.js'

/* Next.js 16 renamed Middleware to Proxy. The file must sit beside `app`,
   so `src/proxy.js` is the right place. */

/** Everything under these prefixes needs a signed-in learner. Every route in
    the `(dashboard)` group belongs here: the group shares one frame, but the
    proxy matches on the URL, which the group name never reaches. */
const PROTECTED = ['/dashboard', '/review', '/progress', '/library']

/** A signed-in learner has no business on these. */
const AUTH_ONLY = ['/sign-in', '/sign-up']

export async function proxy(request) {
  // The response carries any cookies Supabase refreshes, so it has to be
  // created before the client and returned afterwards — a fresh
  // `NextResponse.next()` at the end would drop the new tokens and log the
  // learner out on the next request.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // `getClaims` verifies the token signature; `getSession` only reads the
  // cookie back and would trust whatever the browser sent.
  const { data } = await supabase.auth.getClaims()
  const signedIn = Boolean(data?.claims?.sub)

  const { pathname, search } = request.nextUrl

  if (!signedIn && PROTECTED.some((prefix) => pathname.startsWith(prefix))) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.search = ''
    url.searchParams.set('next', `${pathname}${search}`)
    return NextResponse.redirect(url)
  }

  if (signedIn && AUTH_ONLY.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Static assets carry no session and would only cost a token refresh.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
