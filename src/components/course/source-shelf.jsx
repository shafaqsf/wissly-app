import { describeAnchor } from '@/components/artefact/anchor';
import { quietButtonClass } from '@/components/artefact/control';

/* The shelf: what the learner handed over, and what ingestion made of it.
 *
 * A source opens into its sections with `<details>` and no JavaScript at all,
 * which matters more here than anywhere else on the page — this is the only
 * surface that can prove a citation points somewhere real, and it has to work
 * before hydration for the anchor's `#section-…` to land.
 *
 * Nothing deletes. Archiving is what the shelf shows; the sections, concepts
 * and reading a source produced stay exactly where they are. */

function count(amount, singular, plural = `${singular}s`) {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

export function SectionList({ sections = [] }) {
  if (sections.length === 0) {
    return (
      <p className="max-w-measure text-body-s text-ink-muted">
        No sections were readable in this one.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-6">
      {sections.map((section) => (
        <li
          key={section.id}
          // The destination a citation anchor names. See `sectionHref` in
          // `citation-anchor.jsx` — the two spellings have to agree.
          id={`section-${section.id}`}
          className="flex flex-col gap-1 scroll-mt-16"
        >
          <p className="font-mono text-caption uppercase text-ink-muted">
            Section {section.ordinal}
          </p>
          <p className="font-mono text-caption text-ink-muted">
            {describeAnchor(section.anchor)}
          </p>
          <p className="max-w-measure text-body-s text-ink">{section.content}</p>
        </li>
      ))}
    </ol>
  );
}

/**
 * @param {string} [props.openSourceId] The source a link asked for, expanded on
 *   arrival. Analytics' gap report links straight at the source that leaves a
 *   concept open, and a link that lands on a closed row has shown nobody
 *   anything. An id this course does not have simply opens nothing.
 * @param {boolean} [props.canEdit] Whether the viewer may archive a source.
 *   A shared or public viewer reads under a `select` policy only — 007 never
 *   widens `delete`/`update` — so a form they could submit here would just
 *   fail in the database. Hiding it is the honest version of that.
 */
export default function SourceShelf({
  courseId,
  sources = [],
  archiveAction,
  openSourceId,
  canEdit = true,
}) {
  return (
    <ul className="motion-stagger flex flex-col gap-4">
      {sources.map((source) => (
        <li key={source.id} className="rounded-surface border border-rule">
          <details
            // What a deep link scrolls to, and the element it opens — the two
            // are the same node so a link cannot land on one without the
            // other. `scroll-mt` keeps the row clear of the top of the
            // viewport rather than flush against it.
            id={`source-${source.id}`}
            className="group scroll-mt-16"
            open={source.id === openSourceId}
          >
            <summary className="flex min-h-11 cursor-pointer flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-surface px-4 py-3">
              <span className="text-body">{source.title}</span>
              <span className="font-mono text-caption uppercase text-ink-muted">
                {source.kind} · {count(source.sections?.length ?? 0, 'section')}
              </span>
            </summary>

            <div className="flex flex-col gap-6 border-t border-rule px-4 py-4">
              <SectionList sections={source.sections} />

              {canEdit ? (
                <form action={archiveAction}>
                  <input type="hidden" name="id" value={source.id} />
                  <input type="hidden" name="courseId" value={courseId} />
                  <button
                    type="submit"
                    className={quietButtonClass}
                    aria-label={`Archive ${source.title}`}
                  >
                    Archive
                  </button>
                </form>
              ) : null}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
