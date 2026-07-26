'use server'

import { revalidatePath } from 'next/cache'

import { requireUserId } from '@/lib/auth/user.js'
import { revokeShare, shareCourseByEmail } from '@/lib/data/shares.js'
import { setSubjectPublic } from '@/lib/data/subjects.js'
import { createClient } from '@/lib/supabase/server.js'

/* Sharing and visibility, in the same shape material's actions use: a form
 * `useActionState` drives for the one that can fail in a way worth saying,
 * and plain `<form action>` targets for the two that only ever succeed or
 * do nothing. Every ownership check any of these three could bypass is
 * still enforced in the database — `share_subject_by_email` re-checks it
 * before writing, and `subjects`/`subject_shares` RLS would refuse the
 * write even if this file forgot to ask. */

export async function shareCourseAction(previousState, formData) {
  const subjectId = String(formData.get('courseId') ?? '').trim()
  const email = String(formData.get('email') ?? '').trim()

  if (!subjectId) {
    return { message: 'That course is gone. Open it again and try sharing from there.' }
  }

  if (!email) {
    return { message: 'Enter the email of who you want to share this course with.' }
  }

  const supabase = await createClient()
  await requireUserId(supabase)

  try {
    await shareCourseByEmail(supabase, { subjectId, email })
  } catch (error) {
    return { message: error.message }
  }

  revalidatePath(`/courses/${subjectId}`)

  return { message: null }
}

export async function revokeShareAction(formData) {
  const id = String(formData.get('id') ?? '').trim()
  const courseId = String(formData.get('courseId') ?? '').trim()

  if (!id) return

  const supabase = await createClient()
  await requireUserId(supabase)

  await revokeShare(supabase, { id })

  if (courseId) revalidatePath(`/courses/${courseId}`)
}

export async function setCourseVisibilityAction(formData) {
  const id = String(formData.get('courseId') ?? '').trim()
  const isPublic = formData.get('isPublic') === 'true'

  if (!id) return

  const supabase = await createClient()
  await requireUserId(supabase)

  await setSubjectPublic(supabase, { id, isPublic })

  revalidatePath(`/courses/${id}`)
  revalidatePath('/library')
}
