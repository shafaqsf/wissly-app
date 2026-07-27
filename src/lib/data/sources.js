import { unwrap, unwrapList } from './result.js'

/* A source is what the learner handed over; sections are what ingestion made
 * of it. They are written together because a source without its sections can
 * cite nothing and generate nothing — it is not a half-done upload, it is a
 * broken one. */

const SOURCE_COLUMNS =
  'id, subject_id, kind, title, origin, archived_at, generated, created_at'
const SECTION_COLUMNS = 'id, source_id, ordinal, content, anchor'

/**
 * Every way material arrives, and the whole of the `sources_kind_check`
 * constraint in migration 008. It is exported because anything reading a
 * `kind` back from outside the application — the JSON importer is the one
 * caller today — has to know which values the database will actually accept,
 * and a second hand-written copy of this list is a second thing to keep true.
 */
export const SOURCE_KINDS = Object.freeze(['text', 'pdf', 'pptx', 'url', 'image'])

/** @param {unknown} kind */
export function isSourceKind(kind) {
  return SOURCE_KINDS.includes(kind)
}

export async function listSources(supabase, { subjectId, archived = false } = {}) {
  let query = supabase.from('sources').select(SOURCE_COLUMNS)

  if (subjectId) {
    query = query.eq('subject_id', subjectId)
  }

  // The shelf and the archive are two lists over one table, and every caller
  // wants exactly one of them. Defaulting to the shelf means a caller that
  // forgets cannot accidentally show archived material.
  query = archived
    ? query.not('archived_at', 'is', null)
    : query.is('archived_at', null)

  return unwrapList(
    await query.order('created_at', { ascending: false }),
    'list your material',
  )
}

/**
 * The course shelf: every source with the sections it was cut into.
 *
 * Two queries whatever the size of the shelf. One per source would be easier
 * to write and would grow with the library, which is the wrong direction for
 * the page a learner opens first.
 */
export async function listSourcesWithSections(supabase, { subjectId, archived = false } = {}) {
  const sources = await listSources(supabase, { subjectId, archived })

  if (sources.length === 0) return []

  const sections = unwrapList(
    await supabase
      .from('sections')
      .select(SECTION_COLUMNS)
      .in(
        'source_id',
        sources.map((source) => source.id),
      )
      .order('ordinal', { ascending: true }),
    'read the sources',
  )

  const bySource = new Map(sources.map((source) => [source.id, []]))
  for (const section of sections) {
    bySource.get(section.source_id)?.push(section)
  }

  return sources.map((source) => ({ ...source, sections: bySource.get(source.id) ?? [] }))
}

/**
 * Archive a source. Its sections, concepts and artefacts stay where they are —
 * archiving is about what the shelf shows, not about taking anything away.
 *
 * There is no `deleteSource`, and that is deliberate: destruction is soft
 * everywhere the agent can reach, and the agent can reach this.
 */
export async function archiveSource(supabase, { id, now = () => new Date() }) {
  return unwrap(
    await supabase
      .from('sources')
      .update({ archived_at: now().toISOString() })
      .eq('id', id)
      .select(SOURCE_COLUMNS)
      .single(),
    'archive the source',
  )
}

export async function restoreSource(supabase, { id }) {
  return unwrap(
    await supabase
      .from('sources')
      .update({ archived_at: null })
      .eq('id', id)
      .select(SOURCE_COLUMNS)
      .single(),
    'restore the source',
  )
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
 *
 * `generated` marks a source that was never uploaded — its sections were
 * drafted by the agent's own knowledge from a stated goal rather than cut
 * from something the learner brought. It defaults to false because that is
 * every ordinary path: pasting text, uploading a PDF. The one caller that
 * passes `true` is `buildCourseFromGoal`, and every section it stores also
 * carries `{generated: true}` in its own anchor — belt and braces, because the
 * anchor is what the citation UI actually reads, and a source-level flag that
 * disagreed with its own sections' anchors would be the inconsistency this
 * product cannot afford.
 */
export async function createSource(
  supabase,
  { userId, subjectId, kind, title, rawText, origin, sections = [], generated = false },
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
        origin: origin ?? null,
        generated,
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
