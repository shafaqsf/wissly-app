'use server'

import { revalidatePath } from 'next/cache'

import { createOpenRouterClient, openRouterConfigFromEnv } from '@/lib/agent/openrouter.js'
import { requireUserId } from '@/lib/auth/user.js'
import { courseById } from '@/lib/data/courses.js'
import { addMaterial } from '@/lib/material/add-material.js'
import { fetchReadableText } from '@/lib/material/fetch-url.js'
import { createClient } from '@/lib/supabase/server.js'

/* The form's other half. It fetches the two collaborators — the request's
 * Supabase client and the signed-in learner — and hands them to `addMaterial`,
 * which is where the actual sequence lives and where it is tested.
 *
 * A PDF, a slide deck and pasted text still make no model call — that
 * guarantee holds exactly as it did before this file grew three more source
 * kinds. Two of the new kinds cannot make that promise: a photo has no text
 * underneath it to ingest instead of transcribing, and a diagram-heavy PDF
 * page only gets explained when the learner ticks the box that says so. Both
 * are opt-in in the plainest sense — a file type the learner chose, or a
 * checkbox the learner ticked — never a surprise on an upload that used to
 * cost nothing.
 *
 * The course is no longer typed into the form either — the form lives on a
 * course page, so the page already knows. `addMaterial` still files by title,
 * so the title is read back from the course rather than trusted from the
 * browser. */

/** Anything larger is a book, and a book is not one upload. */
const MAX_BYTES = 10 * 1024 * 1024

const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
const IMAGE_NAME = /\.(jpe?g|png|heic|heif|webp|gif)$/i

/** What a chosen file tells us about the kind of source it is. `null` for
 * anything wissly does not read yet, so the caller can say so plainly rather
 * than filing it under the wrong kind. */
function kindForFile(file) {
  const type = file.type || ''
  const name = String(file.name || '').toLowerCase()
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
  if (type === PPTX_TYPE || name.endsWith('.pptx')) return 'pptx'
  if (type.startsWith('image/') || IMAGE_NAME.test(name)) return 'image'
  return null
}

/**
 * The same OpenRouter plumbing every model call in wissly goes through,
 * pointed at a model that can read an image. `OPENROUTER_VISION_MODEL` is a
 * separate, optional setting — the three curated chat models are not
 * guaranteed to be vision-capable, and this is the one call in the product
 * that requires it — falling back to the configured default when it is
 * unset.
 */
function visionClient() {
  const config = openRouterConfigFromEnv(process.env)
  const model = process.env.OPENROUTER_VISION_MODEL || config.model
  return createOpenRouterClient({ ...config, model })
}

/** The `material` shape `addMaterial` expects, one branch per source kind. */
async function materialFor({ kind, title, text, url, file, course, explainImages }) {
  if (kind === 'pdf') {
    return {
      subject: course.title,
      title: title || file.name,
      kind,
      data: new Uint8Array(await file.arrayBuffer()),
      explainImages,
    }
  }

  if (kind === 'pptx' || kind === 'image') {
    return {
      subject: course.title,
      title: title || file.name,
      kind,
      data: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type || undefined,
    }
  }

  if (kind === 'url') {
    const page = await fetchReadableText(url)
    return {
      subject: course.title,
      title: title || page.title || url,
      kind,
      text: page.text,
      origin: page.url,
    }
  }

  return { subject: course.title, title: title || 'Pasted text', kind: 'text', text }
}

export async function addMaterialAction(previousState, formData) {
  const courseId = String(formData.get('courseId') ?? '').trim()
  const title = String(formData.get('title') ?? '').trim()
  const text = String(formData.get('text') ?? '').trim()
  const url = String(formData.get('url') ?? '').trim()
  const explainImages = formData.get('explainImages') === 'on'
  const file = formData.get('file')
  const hasFile = file && typeof file === 'object' && file.size > 0

  if (!courseId) {
    return { message: 'That course is gone. Open a course and add the material there.' }
  }

  if (!text && !hasFile && !url) {
    return { message: 'Paste some text, paste a link, or choose a file.' }
  }

  if (hasFile && file.size > MAX_BYTES) {
    return { message: 'That file is over 10 MB. Split it, or shrink the photo, and try again.' }
  }

  let kind = 'text'
  if (hasFile) {
    kind = kindForFile(file)
    if (!kind) {
      return { message: 'wissly can read a PDF, a .pptx slide deck or a photo — that file is none of those.' }
    }
  } else if (url) {
    kind = 'url'
  }

  const supabase = await createClient()
  const userId = await requireUserId(supabase)
  const course = await courseById(supabase, { id: courseId })

  if (!course) {
    return { message: 'That course is gone. Open a course and add the material there.' }
  }

  let material

  try {
    material = await materialFor({ kind, title, text, url, file, course, explainImages })
  } catch (error) {
    return { message: error.message }
  }

  let client

  if (kind === 'image' || (kind === 'pdf' && explainImages)) {
    try {
      client = visionClient()
    } catch (error) {
      return { message: error.message }
    }
  }

  let result

  try {
    result = await addMaterial({ supabase, userId, material, client })
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
