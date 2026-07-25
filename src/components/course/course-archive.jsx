import { quietButtonClass } from '@/components/artefact/control';

/* What this course has put away, and the way back.
 *
 * Destruction is soft everywhere the agent can reach, so there is no delete
 * here and there is nothing to add one to: archiving sets `archived_at` and
 * restoring clears it. An archive with no restore is a delete with extra
 * steps. */

/** A reading row's own name, since a summary has no title of its own. */
function readingName(artefact) {
  if (artefact.format === 'glossary') return artefact.payload?.term ?? 'Glossary entry';
  return `Summary of section ${artefact.section_ordinal ?? '—'}`;
}

function RestoreRow({ courseId, id, label, action }) {
  return (
    <li className="flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule py-3">
      <span className="text-body-s">{label}</span>
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="courseId" value={courseId} />
        <button type="submit" className={quietButtonClass} aria-label={`Restore ${label}`}>
          Restore
        </button>
      </form>
    </li>
  );
}

export default function CourseArchive({
  courseId,
  sources = [],
  artefacts = [],
  restoreSourceAction,
  restoreReadingAction,
}) {
  if (sources.length === 0 && artefacts.length === 0) {
    return (
      <p className="max-w-measure text-body-s text-ink-muted">
        Nothing archived. What you archive from this course lands here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {sources.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="font-mono text-label uppercase text-ink-muted">Sources</h3>
          <ul className="flex flex-col border-t border-rule">
            {sources.map((source) => (
              <RestoreRow
                key={source.id}
                courseId={courseId}
                id={source.id}
                label={source.title}
                action={restoreSourceAction}
              />
            ))}
          </ul>
        </section>
      ) : null}

      {artefacts.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h3 className="font-mono text-label uppercase text-ink-muted">Reading</h3>
          <ul className="flex flex-col border-t border-rule">
            {artefacts.map((artefact) => (
              <RestoreRow
                key={artefact.id}
                courseId={courseId}
                id={artefact.id}
                label={readingName(artefact)}
                action={restoreReadingAction}
              />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
