import { unwrap, unwrapList } from './result.js'

/* A source is what the learner handed over; sections are what ingestion made
 * of it. They are written together because a source without its sections can
 * cite nothing and generate nothing — it is not a half-done upload, it is a
 * broken one. */

const SOURCE_COLUMNS = 'id, subject_id, kind, title, created_at'
const SECTION_COLUMNS = 'id, source_id, ordinal, content, anchor'

export async function listSources(supabase, { subjectId } = {}) {
  let query = supabase
    .from('sources')
    .select(SOURCE_COLUMNS)
    .order('created_at', { ascending: false })

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  return unwrapList(await query, 'list your material')
}

export async function sectionsForSource(supabase, { sourceId }) {
  return unwrapList(
    await supabase
      .from('sections')
      .select(SECTION_COLUMNS)
      .eq('source_id', sourceId)
      .order('ordinal', { ascending: true }),
    'read the source',
  )
}

/**
 * Store a source and the sections ingestion produced from it.
 *
 * Postgres has no transaction across two PostgREST calls, so a failure
 * between them would leave a source with no sections. That is why the source
 * is deleted again if the sections do not land: a missing source is a state
 * the learner can retry, an empty one is a ghost in the library.
 */
export async function createSource(
  supabase,
  { userId, subjectId, kind, title, rawText, sections = [] },
) {
  if (sections.length === 0) {
    throw new Error('There was no readable text in that. Check the file and try again.')
  }

  const source = unwrap(
    await supabase
      .from('sources')
      .insert({
        user_id: userId,
        subject_id: subjectId,
        kind,
        title: String(title ?? '').trim() || 'Untitled',
        raw_text: rawText ?? null,
      })
      .select(SOURCE_COLUMNS)
      .single(),
    'store the source',
  )

  const rows = sections.map((section) => ({
    user_id: userId,
    source_id: source.id,
    ordinal: section.ordinal,
    content: section.content,
    anchor: section.anchor ?? null,
  }))

  try {
    const stored = unwrapList(
      await supabase.from('sections').insert(rows).select(SECTION_COLUMNS),
      'store the sections',
    )

    return { source, sections: stored }
  } catch (error) {
    await supabase.from('sources').delete().eq('id', source.id)
    throw error
  }
}
