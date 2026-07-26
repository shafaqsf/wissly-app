import 'server-only'

import { randomUUID } from 'crypto'

import { unwrap, unwrapList } from '../data/result.js'

/* The other half of the round trip: a bundle in the shape
 * `src/lib/data/export.js` produces, written back as new rows under the
 * importing learner.
 *
 * **Every id is regenerated.** The exported ids named someone's rows once —
 * possibly this learner's own, possibly not, since re-importing your own
 * export is the round trip this module exists to prove — and inserting under
 * the original id would either collide or, worse, silently take over a row
 * RLS happens to let through. A fresh `id` is picked for every row *before*
 * it is written, so the tables below it (sections under a source, artefacts
 * under a section and a concept, reviews under an artefact) can point at
 * where the row actually landed rather than at the id that came off disk.
 *
 * **Nothing here re-derives what the source already decided.** A concept's
 * term, an artefact's payload and origin, a review's rating and FSRS state —
 * all written verbatim. Re-deriving any of them would be a second definition
 * of "the same data" to keep in step with the first.
 */

function assertBundle(bundle) {
  if (!bundle || !Array.isArray(bundle.courses)) {
    throw new Error(
      'That file is not a wissly export. Choose the JSON file Settings → Export & import produced.',
    )
  }
}

export async function importBundle(supabase, { userId, bundle, now = () => new Date() }) {
  assertBundle(bundle)

  const summary = { courses: 0, sources: 0, sections: 0, concepts: 0, artefacts: 0, reviews: 0 }

  for (const course of bundle.courses) {
    await importCourse(supabase, { userId, course, now, summary })
  }

  return summary
}

async function importCourse(supabase, { userId, course, now, summary }) {
  const subjectId = randomUUID()

  unwrap(
    await supabase
      .from('subjects')
      .insert({
        id: subjectId,
        user_id: userId,
        title: String(course.subject?.title ?? 'Imported course').trim() || 'Imported course',
      })
      .select('id')
      .single(),
    'import the course',
  )
  summary.courses += 1

  const sectionIdMap = new Map();

  for (const source of course.sources ?? []) {
    const sourceId = randomUUID()

    unwrap(
      await supabase
        .from('sources')
        .insert({
          id: sourceId,
          user_id: userId,
          subject_id: subjectId,
          kind: source.kind === 'pdf' ? 'pdf' : 'text',
          title: source.title || 'Untitled',
          raw_text: source.raw_text ?? null,
          archived_at: source.archived_at ?? null,
        })
        .select('id')
        .single(),
      'import a source',
    )
    summary.sources += 1

    const sectionRows = (source.sections ?? []).map((section) => {
      const id = randomUUID()
      sectionIdMap.set(section.id, id)
      return {
        id,
        user_id: userId,
        source_id: sourceId,
        ordinal: section.ordinal,
        content: section.content,
        anchor: section.anchor ?? null,
      }
    })

    if (sectionRows.length > 0) {
      unwrapList(
        await supabase.from('sections').insert(sectionRows).select('id'),
        'import the sections',
      )
      summary.sections += sectionRows.length
    }
  }

  const conceptIdMap = new Map();
  const conceptRows = (course.concepts ?? []).map((concept) => {
    const id = randomUUID()
    conceptIdMap.set(concept.id, id)
    return {
      id,
      user_id: userId,
      subject_id: subjectId,
      term: concept.term || 'Untitled',
      definition: concept.definition ?? null,
      section_id: concept.section_id ? (sectionIdMap.get(concept.section_id) ?? null) : null,
    }
  })

  if (conceptRows.length > 0) {
    unwrapList(await supabase.from('concepts').insert(conceptRows).select('id'), 'import the concepts')
    summary.concepts += conceptRows.length
  }

  const artefactIdMap = new Map();
  const artefactRows = (course.artefacts ?? []).map((artefact) => {
    const id = randomUUID()
    artefactIdMap.set(artefact.id, id)
    return {
      id,
      user_id: userId,
      subject_id: subjectId,
      section_id: artefact.section_id ? (sectionIdMap.get(artefact.section_id) ?? null) : null,
      concept_id: artefact.concept_id ? (conceptIdMap.get(artefact.concept_id) ?? null) : null,
      format: artefact.format,
      payload: artefact.payload,
      origin: artefact.origin === 'manual' ? 'manual' : 'agent',
      archived_at: artefact.archived_at ?? null,
    }
  })

  if (artefactRows.length > 0) {
    unwrapList(
      await supabase.from('artefacts').insert(artefactRows).select('id'),
      'import the tasks and reading',
    )
    summary.artefacts += artefactRows.length
  }

  // A review whose artefact was not in this bundle (a partial or corrupted
  // export) has nowhere to point. Dropped rather than failing the whole
  // import over one orphaned row.
  const reviewRows = (course.reviews ?? [])
    .filter((review) => artefactIdMap.has(review.artefact_id))
    .map((review) => ({
      user_id: userId,
      artefact_id: artefactIdMap.get(review.artefact_id),
      reviewed_at: review.reviewed_at ?? now().toISOString(),
      rating: review.rating,
      stability: review.stability ?? null,
      difficulty: review.difficulty ?? null,
      due_at: review.due_at ?? null,
      reps: review.reps ?? 0,
      lapses: review.lapses ?? 0,
    }))

  if (reviewRows.length > 0) {
    unwrapList(
      await supabase.from('reviews').insert(reviewRows).select('id'),
      'import the review history',
    )
    summary.reviews += reviewRows.length
  }
}
