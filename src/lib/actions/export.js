'use server'

import { revalidatePath } from 'next/cache'

import { requireUserId } from '@/lib/auth/user.js'
import { allDataBundle, courseBundle } from '@/lib/data/export.js'
import { importBundle } from '@/lib/import/json.js'
import { createClient } from '@/lib/supabase/server.js'

/* Export and import, as the settings page reaches them. Both build the whole
 * bundle server-side — review history alone is not something any page today
 * already has loaded — and hand it to a client component that turns it into
 * a file (`src/lib/export/*`) or reads one back in (`src/lib/import/json.js`
 * did the actual writing; this is just the request-scoped wiring). */

export async function exportDataAction({ courseId = null } = {}) {
  const supabase = await createClient()
  await requireUserId(supabase)

  try {
    const bundle = courseId
      ? await courseBundle(supabase, { subjectId: courseId })
      : await allDataBundle(supabase)

    if (!bundle) return { error: 'That course is no longer there.' }

    return { bundle }
  } catch (error) {
    return { error: error.message }
  }
}

export async function importDataAction({ bundle }) {
  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  try {
    const summary = await importBundle(supabase, { userId, bundle })

    revalidatePath('/courses')
    revalidatePath('/dashboard')
    revalidatePath('/tasks', 'layout')

    return { summary }
  } catch (error) {
    return { error: error.message }
  }
}
