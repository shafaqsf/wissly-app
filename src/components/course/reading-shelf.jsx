import { quietButtonClass } from '@/components/artefact/control';
import GlossaryArtefact from '@/components/artefact/glossary-artefact';
import SummaryArtefact from '@/components/artefact/summary-artefact';
import { isReadingFormat } from '@/lib/agent/formats';

/* Reading sits beside the material it came from, because that is the decision
   the whole restructuring turns on: understanding lives with the material,
   recall lives with the tasks. A summary and a glossary entry ask nothing and
   produce no evidence, so they are never due and never appear in Tasks.

   Anything that is not a reading format is filtered out rather than rendered
   by some generic dispatcher. A flashcard on this page would be a task on the
   wrong shelf. */

const RENDERERS = {
  summary: SummaryArtefact,
  glossary: GlossaryArtefact,
};

/** What to call one of these in a button, in the learner's words. */
const NAMES = {
  summary: 'this summary',
  glossary: 'this glossary entry',
};

export default function ReadingShelf({ courseId, artefacts = [], archiveAction }) {
  const reading = artefacts.filter((artefact) => isReadingFormat(artefact.format));

  return (
    <ul className="motion-stagger flex flex-col gap-12">
      {reading.map((artefact) => {
        const Renderer = RENDERERS[artefact.format];

        return (
          <li key={artefact.id} className="flex flex-col gap-4">
            <Renderer artefact={artefact} />

            <form action={archiveAction}>
              <input type="hidden" name="id" value={artefact.id} />
              <input type="hidden" name="courseId" value={courseId} />
              <button
                type="submit"
                className={quietButtonClass}
                aria-label={`Archive ${NAMES[artefact.format]}`}
              >
                Archive
              </button>
            </form>
          </li>
        );
      })}
    </ul>
  );
}
