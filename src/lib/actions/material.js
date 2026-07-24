'use server'

import { revalidatePath } from 'next/cache'

import { createOpenRouterClient, openRouterConfigFromEnv } from '@/lib/agent/openrouter.js'
import { requireUserId } from '@/lib/auth/user.js'
import { addMaterial } from '@/lib/material/add-material.js'
import { createClient } from '@/lib/supabase/server.js'

/* The form's other half. It fetches the three collaborators — the request's
 * Supabase client, an OpenRouter client, the signed-in learner — and hands
 * them to `addMaterial`, which is where the actual sequence lives and where
 * it is tested. */

/** Anything larger is a book, and a book is not one upload. */
const MAX_BYTES = 10 * 1024 * 1024

export async function addMaterialAction(previousState, formData) {
  const subject = String(formData.get('subject') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const text = String(formData.get('text') ?? '').trim()
  const file = formData.get('file')
  const hasFile = file && typeof file === 'object' && file.size > 0

  if (!subject) {
    return { message: 'Name the subject this belongs to.' }
  }

  if (!text && !hasFile) {
    return { message: 'Paste some text or choose a PDF.' }
  }

  if (hasFile && file.size > MAX_BYTES) {
    return { message: 'That file is over 10 MB. Split it and add the parts.' }
  }

  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  const material = hasFile
    ? {
        subject,
        title: title || file.name,
        kind: 'pdf',
        data: new Uint8Array(await file.arrayBuffer()),
      }
    : { subject, title: title || 'Pasted text', kind: 'text', text }

  let result

  try {
    result = await addMaterial({
      supabase,
      client: createOpenRouterClient(openRouterConfigFromEnv()),
      userId,
      material,
    })
  } catch (error) {
    // What went wrong is worth saying; the stack is not. The learner needs to
    // know whether to retry, change the file, or wait.
    return { message: error.message }
  }

  revalidatePath('/library')
  revalidatePath('/review')
  revalidatePath('/progress')
  revalidatePath('/dashboard')

  return { message: summarise(result), done: true }
}

/** What actually happened, in the learner's terms. Never a silent truncation. */
function summarise({ source, sections, artefacts, skipped, failures = [] }) {
  const parts = [
    `Added ${source.title}: ${count(sections.length, 'section')}, ${count(artefacts.length, 'artefact')}.`,
  ]

  if (skipped > 0) {
    parts.push(`${count(skipped, 'section')} past the first twelve were stored but not generated from.`)
  }

  if (failures.length > 0) {
    parts.push(`${count(failures.length, 'section')} could not be generated from. Add the material again to retry those.`)
  }

  return parts.join(' ')
}

function count(n, noun) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}
