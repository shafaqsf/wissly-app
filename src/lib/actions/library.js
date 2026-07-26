'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { requireUserId } from '@/lib/auth/user.js'
import { importCourse } from '@/lib/data/library.js'
import { createClient } from '@/lib/supabase/server.js'

/* `/library` itself needs no session — that is the point of a public
 * library — but importing writes, so `requireUserId` sends a signed-out
 * visitor to sign in first and back to a plain retry after. The page also
 * offers a direct sign-in link so nobody has to submit a form to discover
 * that. */
export async function importCourseAction(previousState, formData) {
  const subjectId = String(formData.get('courseId') ?? '').trim()

  if (!subjectId) {
    return { message: 'That course is gone.' }
  }

  const supabase = await createClient()
  const userId = await requireUserId(supabase)

  let course

  try {
    course = await importCourse(supabase, { subjectId, userId })
  } catch (error) {
    return { message: error.message }
  }

  revalidatePath('/courses')

  redirect(`/courses/${course.id}`)
}
