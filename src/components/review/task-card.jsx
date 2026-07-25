'use client';

import ClozeArtefact from '@/components/artefact/cloze-artefact';
import FlashcardArtefact from '@/components/artefact/flashcard-artefact';
import MultipleChoiceArtefact from '@/components/artefact/multiple-choice-artefact';
import OpenQuestionArtefact from '@/components/artefact/open-question-artefact';
import { FORMAT_NAMES } from '@/components/task/task-types';

/* One card in the mixed queue.

   The generic dispatcher this replaces stood between every surface in the
   product and its renderer, which meant no surface could offer anything the
   other five did not want. Due is the one place that genuinely does not know
   the type until the row arrives, so the switch lives here and covers the
   four answerable formats only. */

const RENDERERS = {
  flashcard: FlashcardArtefact,
  cloze: ClozeArtefact,
  multiple_choice: MultipleChoiceArtefact,
  open_question: OpenQuestionArtefact,
};

export default function TaskCard({ artefact, onAnswered, onGrade, turned, onTurn }) {
  const Renderer = RENDERERS[artefact.format];
  const name = FORMAT_NAMES[artefact.format] ?? 'Task';

  return (
    <section
      // The type is what the region is; the payload carries no title and
      // inventing one would put words in the source's mouth.
      aria-label={name}
      data-format={artefact.format}
      className="flex flex-col gap-4"
    >
      {Renderer ? (
        <>
          <p className="font-mono text-label uppercase text-ink-muted">{name}</p>
          <Renderer
            artefact={artefact}
            onAnswered={onAnswered}
            onGrade={onGrade}
            // Only the flashcard reads these. Everything else answers by
            // typing or by choosing and has nothing to turn.
            turned={turned}
            onTurn={onTurn}
          />
        </>
      ) : (
        <p
          role="alert"
          className="max-w-measure border-l-2 border-ink pl-4 text-body-s text-ink"
        >
          This is read rather than answered, so it is not due. Skip it.
        </p>
      )}
    </section>
  );
}
