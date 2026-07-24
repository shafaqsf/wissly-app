'use client';

import SummaryArtefact from './summary-artefact';
import GlossaryArtefact from './glossary-artefact';
import FlashcardArtefact from './flashcard-artefact';
import ClozeArtefact from './cloze-artefact';
import MultipleChoiceArtefact from './multiple-choice-artefact';
import OpenQuestionArtefact from './open-question-artefact';

/* One artefact, whatever format it turned out to be. Callers — the review
   queue, a lesson page — hand over the record and stay out of the question.
   Each renderer is a small component with one job; this is only the switch
   and the frame around it. */

const RENDERERS = {
  summary: SummaryArtefact,
  glossary: GlossaryArtefact,
  flashcard: FlashcardArtefact,
  cloze: ClozeArtefact,
  multiple_choice: MultipleChoiceArtefact,
  open_question: OpenQuestionArtefact,
};

// Named the way a learner would name them, never after the column they sit in.
export const FORMAT_NAMES = {
  summary: 'Summary',
  glossary: 'Glossary',
  flashcard: 'Flashcard',
  cloze: 'Fill the gap',
  multiple_choice: 'Multiple choice',
  open_question: 'Open question',
};

export default function Artefact({ artefact, onAnswered, onGrade }) {
  const Renderer = RENDERERS[artefact.format];

  return (
    <section
      aria-label={artefact.title}
      data-format={artefact.format}
      className="flex flex-col gap-4"
    >
      <header className="flex flex-col gap-1">
        <p className="font-mono text-label uppercase text-ink-muted">
          {FORMAT_NAMES[artefact.format] ?? 'Artefact'}
        </p>
        <h2 className="font-display text-heading font-semibold">
          {artefact.title}
        </h2>
      </header>

      {Renderer ? (
        <Renderer artefact={artefact} onAnswered={onAnswered} onGrade={onGrade} />
      ) : (
        <p
          role="alert"
          className="max-w-measure border-l-2 border-ink pl-4 text-body-s text-ink"
        >
          This format cannot be shown yet. Pick another artefact for now.
        </p>
      )}
    </section>
  );
}
