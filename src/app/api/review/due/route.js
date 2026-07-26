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
    return json({ error: error.message }, 500)
  }
}
