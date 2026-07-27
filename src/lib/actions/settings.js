'use server'

import { revalidatePath } from 'next/cache'

import { requireUserId } from '@/lib/auth/user.js'
import { setDefaultModel } from '@/lib/data/preferences.js'
import { createClient } from '@/lib/supabase/server.js'

/* Settings' other half. Small on purpose: one preference exists so far, and
 * this is the one action it needs. */

export async function updateDefaultModelAction({ model }) {
  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  try {
    const preferences = await setDefaultModel(supabase, {
      userId,
      model: model || null,
    })

    revalidatePath('/settings')

    return { preferences }
  } catch (error) {
    return { error: error.message }
  }
}
