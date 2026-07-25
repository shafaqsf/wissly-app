'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireUserId } from '@/lib/auth/user.js'
import { archiveArtefact, restoreArtefact } from '@/lib/data/artefacts.js'
import { createCourse } from '@/lib/data/courses.js'
import { archiveSource, restoreSource } from '@/lib/data/sources.js'
import { createClient } from '@/lib/supabase/server.js'

/* What the course surfaces call.
 *
 * Every one of these is a plain `<form action={…}>` target rather than
 * something a client component invokes, so archiving a source works with no
 * JavaScript at all and the shelf needs no state of its own.
 *
 * Nothing here deletes. Destruction is soft everywhere the agent can reach,
 * and an archived source keeps its sections, concepts and reading — archiving
 * is about what the shelf shows, not about taking anything away. */

/**
 * Create a course, then open it.
 *
 * A course used to appear only as a side effect of adding material, which made
 * "start a course, then fill it" impossible to say. The redirect is the other
 * half of that: the learner named a thing, so the thing is where they land,
 * empty, with its own invitation to add the first material.
 */
export async function createCourseAction(previousState, formData) {
  const title = String(formData.get('title') ?? '').trim()

  if (!title) {
    return { message: 'Give the course a name.' }
  }

  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  let course

  try {
    course = await createCourse(supabase, { userId, title })
  } catch (error) {
    return { message: error.message }
  }

  revalidatePath('/courses')
  revalidatePath('/dashboard')

  // `redirect` throws, so it has to sit outside the try above or it would be
  // reported to the learner as a failure to create the course.
  redirect(`/courses/${course.id}`)
}

/* The four archive verbs are one shape. They are written out one by one all
 * the same: a `'use server'` module may only export functions the compiler can
 * see are async, so a factory returning them would not survive the build. */

async function shelf(formData, run) {
  const id = String(formData.get('id') ?? '').trim()
  const courseId = String(formData.get('courseId') ?? '').trim()

  if (!id) return

  const supabase = await createClient()
  await requireUserId(supabase)

  await run(supabase, { id })

  if (courseId) revalidatePath(`/courses/${courseId}`)
  revalidatePath('/courses')
  revalidatePath('/dashboard')
}

export async function archiveSourceAction(formData) {
  return shelf(formData, archiveSource)
}

export async function restoreSourceAction(formData) {
  return shelf(formData, restoreSource)
}

export async function archiveReadingAction(formData) {
  return shelf(formData, archiveArtefact)
}

export async function restoreReadingAction(formData) {
  return shelf(formData, restoreArtefact)
}
