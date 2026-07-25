'use server'

import { revalidatePath } from 'next/cache'

import { requireUserId } from '@/lib/auth/user.js'
import { courseById } from '@/lib/data/courses.js'
import { addMaterial } from '@/lib/material/add-material.js'
import { createClient } from '@/lib/supabase/server.js'

/* The form's other half. It fetches the two collaborators — the request's
 * Supabase client and the signed-in learner — and hands them to `addMaterial`,
 * which is where the actual sequence lives and where it is tested.
 *
 * There is no OpenRouter client here any more, and that absence is the point:
 * adding material ingests, files and names, and makes no model call. Anything
 * generated is asked for on the type's own surface.
 *
 * The course is no longer typed into the form either — the form lives on a
 * course page, so the page already knows. `addMaterial` still files by title,
 * so the title is read back from the course rather than trusted from the
 * browser. */

/** Anything larger is a book, and a book is not one upload. */
const MAX_BYTES = 10 * 1024 * 1024

export async function addMaterialAction(previousState, formData) {
  const courseId = String(formData.get('courseId') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const text = String(formData.get('text') ?? '').trim()
  const file = formData.get('file')
  const hasFile = file && typeof file === 'object' && file.size > 0

  if (!courseId) {
    return { message: 'That course is gone. Open a course and add the material there.' }
  }

  if (!text && !hasFile) {
    return { message: 'Paste some text or choose a PDF.' }
  }

  if (hasFile && file.size > MAX_BYTES) {
    return { message: 'That file is over 10 MB. Split it and add the parts.' }
  }

  const supabase = await createClient()
  const userId = await requireUserId(supabase)
  const course = await courseById(supabase, { id: courseId })

  if (!course) {
    return { message: 'That course is gone. Open a course and add the material there.' }
  }

  const material = hasFile
    ? {
        subject: course.title,
        title: title || file.name,
        kind: 'pdf',
        data: new Uint8Array(await file.arrayBuffer()),
      }
    : { subject: course.title, title: title || 'Pasted text', kind: 'text', text }

  let result

  try {
    result = await addMaterial({ supabase, userId, material })
  } catch (error) {
    // What went wrong is worth saying; the stack is not. The learner needs to
    // know whether to retry, change the file, or wait.
    return { message: error.message }
  }

  revalidatePath('/courses')
  revalidatePath(`/courses/${courseId}`)
  revalidatePath('/dashboard')

  return { message: summarise(result), done: true }
}

/**
 * What actually happened, in the learner's terms.
 *
 * Sections and concepts, and then the sentence that matters most on a surface
 * that used to hand back twelve generated cards: nothing was generated. An
 * empty shelf after an upload is the new behaviour, not a failure, and the
 * report has to say so or it reads as one.
 */
function summarise({ source, sections, concepts }) {
  return [
    `Added ${source.title}: ${count(sections.length, 'section')}, ${count(concepts.length, 'concept')}.`,
    'Nothing was generated — write or generate tasks when you are ready.',
  ].join(' ')
}

function count(n, noun) {
  return `${n} ${noun}${n === 1 ? '' : 's'}`
}
