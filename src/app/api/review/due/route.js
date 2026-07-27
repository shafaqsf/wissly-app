import { currentUserId } from '@/lib/auth/user.js'
import { dueArtefacts } from '@/lib/data/review.js'
import { createClient } from '@/lib/supabase/server.js'

/**
 * What is due, as JSON.
 *
 * `ReviewSession` never calls this — the dashboard renders the queue
 * server-side, same as every page. This route exists for the service worker:
 * `public/sw.js` fetches it while online and caches the answer, so the queue
 * a learner opens offline is the one it last saw rather than an empty page.
 * `GET /api/review/due?course=<id>` narrows it to one course, matching
 * `/tasks/due?course=`.
 */

export const runtime = 'nodejs'

function json(body, status = 200) {
  return Response.json(body, { status })
}

export async function GET(request) {
  const supabase = await createClient()

  const userId = await currentUserId(supabase)
  if (!userId) return json({ error: 'Sign in first.' }, 401)

  const subjectId = new URL(request.url).searchParams.get('course') || undefined

  try {
    const due = await dueArtefacts(supabase, { subjectId })
    return json({ due })
  } catch (error) {
    // Not `error.message`. `DataError` (src/lib/data/result.js) forwards the
    // database's own wording verbatim, which names constraints, columns and
    // sometimes the query itself. That belongs in the server log, not in a
    // response the browser — or the service worker caching it — can read.
    console.error('due review fetch failed', error)
    return json({ error: 'Could not read your queue.' }, 500)
  }
}
