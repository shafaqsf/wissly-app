import { DataError, unwrap, unwrapList } from './result.js'

/* The public library is the read side of `subjects.is_public` (migrations/
 * 015): anyone, signed in or not, can see a public course through the
 * `select` policies 015 adds. Importing needs a session — it writes — and
 * is a plain client-side copy rather than a stored procedure: everything it
 * reads is already open under the public policies, and everything it writes
 * lands under the importer's own `user_id`, which every table's existing
 * owner-only insert policy already allows. No elevated privilege is needed
 * to "read what anyone can read, then write what you always could". */

const PUBLIC_COURSE_COLUMNS = 'id, title, user_id, created_at'

/** Every public course, newest first. Works for a signed-out visitor. */
export async function listPublicCourses(supabase) {
  return unwrapList(
    await supabase
      .from('subjects')
      .select(PUBLIC_COURSE_COLUMNS)
      .eq('is_public', true)
      .order('created_at', { ascending: false }),
    'browse the public library',
  )
}

/** One public course, or null — never a private one, even by a guessed id. */
export async function publicCourseById(supabase, { id }) {
  const data = unwrap(
    await supabase
      .from('subjects')
      .select(PUBLIC_COURSE_COLUMNS)
      .eq('id', id)
      .eq('is_public', true)
      .maybeSingle(),
    'open the course',
  )

  return data ?? null
}

/**
 * Clone a public course into the importer's own account: a new subject and a
 * copy of every unarchived source, section, concept and artefact it holds.
 *
 * Review history is never copied. A fresh copy with somebody else's review
 * log would both be meaningless (FSRS state describes one learner's recall,
 * not the material) and a privacy leak the public flag never agreed to.
 */
export async function importCourse(supabase, { subjectId, userId }) {
  const original = await publicCourseById(supabase, { id: subjectId })

  if (!original) {
    throw new DataError('That course is not public, or no longer exists.', {
      operation: 'import the course',
    })
  }

  const newSubject = unwrap(
    await supabase
      .from('subjects')
      .insert({ user_id: userId, title: original.title })
      .select('id, title')
      .single(),
    'start the imported course',
  )

  const sourceRows = unwrapList(
    await supabase
      .from('sources')
      .select('id, kind, title, raw_text')
      .eq('subject_id', subjectId)
      .is('archived_at', null),
    'read the course material',
  )

  const sectionIdMap = new Map()

  for (const row of sourceRows) {
    const newSource = unwrap(
      await supabase
        .from('sources')
        .insert({
          user_id: userId,
          subject_id: newSubject.id,
          kind: row.kind,
          title: row.title,
          raw_text: row.raw_text,
        })
        .select('id')
        .single(),
      'copy a source',
    )

    const sectionRows = unwrapList(
      await supabase
        .from('sections')
        .select('id, ordinal, content, anchor')
        .eq('source_id', row.id),
      'read the material’s sections',
    )

    for (const section of sectionRows) {
      const newSection = unwrap(
        await supabase
          .from('sections')
          .insert({
            user_id: userId,
            source_id: newSource.id,
            ordinal: section.ordinal,
            content: section.content,
            anchor: section.anchor,
          })
          .select('id')
          .single(),
        'copy a section',
      )

      sectionIdMap.set(section.id, newSection.id)
    }
  }

  const conceptRows = unwrapList(
    await supabase
      .from('concepts')
      .select('id, term, definition, section_id')
      .eq('subject_id', subjectId),
    'read the course’s concepts',
  )

  const conceptIdMap = new Map()

  for (const concept of conceptRows) {
    const newConcept = unwrap(
      await supabase
        .from('concepts')
        .insert({
          user_id: userId,
          subject_id: newSubject.id,
          term: concept.term,
          definition: concept.definition,
          section_id: concept.section_id ? (sectionIdMap.get(concept.section_id) ?? null) : null,
        })
        .select('id')
        .single(),
      'copy a concept',
    )

    conceptIdMap.set(concept.id, newConcept.id)
  }

  const artefactRows = unwrapList(
    await supabase
      .from('artefacts')
      .select('id, section_id, concept_id, format, payload')
      .eq('subject_id', subjectId)
      .is('archived_at', null),
    'read the course’s artefacts',
  )

  for (const artefact of artefactRows) {
    unwrap(
      await supabase.from('artefacts').insert({
        user_id: userId,
        subject_id: newSubject.id,
        section_id: artefact.section_id ? (sectionIdMap.get(artefact.section_id) ?? null) : null,
        concept_id: artefact.concept_id ? (conceptIdMap.get(artefact.concept_id) ?? null) : null,
        format: artefact.format,
        payload: artefact.payload,
        origin: 'manual',
      }),
      'copy an artefact',
    )
  }

  return newSubject
}
