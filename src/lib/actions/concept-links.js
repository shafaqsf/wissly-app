'use server'

import { revalidatePath } from 'next/cache'

import { suggestConceptLinks } from '@/lib/agent/concept-links.js'
import { createOpenRouterClient, openRouterConfigFromEnv } from '@/lib/agent/openrouter.js'
import { requireUserId } from '@/lib/auth/user.js'
import { createConceptLinks, existingPairs, pairKey } from '@/lib/data/concept-links.js'
import { candidateConcepts, listConcepts } from '@/lib/data/concepts.js'
import { createClient } from '@/lib/supabase/server.js'

/* What the course page's "Find related concepts" button calls.
 *
 * Asymmetric with reading and writing a concept the same way `task.js`'s two
 * verbs are: nothing about a concept costs a model call until this is
 * pressed. Uploading material never triggers it — `material.js` already
 * makes that promise for sections and concepts, and this is the same promise
 * for the links between them.
 */

/**
 * Find "see also" links from this course's concepts to the rest of the
 * library, and store the ones that are new.
 */
export async function generateConceptLinksAction(previousState, formData) {
  const subjectId = String(formData.get('subjectId') ?? '').trim()
  if (!subjectId) return { message: 'That course is gone. Reload the page.' }

  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  const concepts = await listConcepts(supabase, { subjectId })
  if (concepts.length === 0) {
    return { message: 'Add material to this course first — there is nothing to link yet.' }
  }

  const candidates = await candidateConcepts(supabase, {
    excludeIds: concepts.map((concept) => concept.id),
  })
  if (candidates.length === 0) {
    return { message: 'There is nothing else in your library to link to yet.' }
  }

  const conceptIds = concepts.map((concept) => concept.id)
  const alreadyLinked = await existingPairs(supabase, { conceptIds })

  let suggested

  try {
    suggested = await suggestConceptLinks({
      client: createOpenRouterClient(openRouterConfigFromEnv()),
      concepts: concepts.map((concept) => ({
        id: concept.id,
        term: concept.term,
        definition: concept.definition,
      })),
      candidates,
    })
  } catch (error) {
    return { message: error.message }
  }

  const fresh = suggested.filter(
    (link) => !alreadyLinked.has(pairKey(link.conceptId, link.relatedConceptId)),
  )

  if (fresh.length === 0) {
    return { message: 'No new related concepts found.', done: true }
  }

  try {
    await createConceptLinks(supabase, { userId, links: fresh })
  } catch (error) {
    return { message: error.message }
  }

  revalidatePath(`/courses/${subjectId}`)
  revalidatePath(`/courses/${subjectId}/map`)

  return { message: summarise(fresh), done: true }
}

function summarise(links) {
  return `Found ${links.length} related concept${links.length === 1 ? '' : 's'}.`
}
