'use client';

import { CLOZE_BLANK } from '@/lib/agent/formats';
import CitationAnchor, { sectionHref } from '@/components/artefact/citation-anchor';
import { renderInline } from '@/components/artefact/prose';

/* What one row of each type looks like in the table.

   Four functions rather than four components, because each of them is a row
   body and nothing else — the checkbox, the edit and the origin are the
   table's, and the surface around them is the type's. The read-only renderers
   next door answer a task; these only show one. */

export function flashcardRow(task) {
  return (
    <div className="flex flex-col gap-1">
      <p className="max-w-measure text-body">{renderInline(task.payload.front)}</p>
      <p className="max-w-measure text-body-s text-ink-muted">
        {renderInline(task.payload.back)}
      </p>
      <Source task={task} />
    </div>
  );
}

export function clozeRow(task) {
  const [before, after = ''] = String(task.payload.text).split(CLOZE_BLANK);

  return (
    <div className="flex flex-col gap-1">
      {/* The gap is drawn as a gap: an underlined space the width of the word
          that was taken out, so the sentence still reads as a sentence. */}
      <p className="max-w-measure text-body">
        {renderInline(before)}
        <span className="border-b-2 border-b-ink px-6" aria-label="the missing word" />
        {renderInline(after)}
      </p>
      <p className="font-mono text-caption text-ink-muted">{task.payload.answer}</p>
      <Source task={task} />
    </div>
  );
}

export function multipleChoiceRow(task) {
  const { stem, options, answer_index: answerIndex } = task.payload;

  return (
    <div className="flex flex-col gap-1">
      <p className="max-w-measure text-body">{renderInline(stem)}</p>
      <ul className="flex max-w-measure flex-col text-body-s text-ink-muted">
        {options.map((option, index) => (
          <li key={option} className={index === answerIndex ? 'text-ink' : undefined}>
            {index === answerIndex ? '— ' : '  '}
            {option}
            {index === answerIndex ? (
              <span className="ml-2 font-mono text-caption uppercase">the right one</span>
            ) : null}
          </li>
        ))}
      </ul>
      <Source task={task} />
    </div>
  );
}

export function openQuestionRow(task) {
  return (
    <div className="flex flex-col gap-1">
      <p className="max-w-measure text-body">{renderInline(task.payload.prompt)}</p>
      <p className="max-w-measure text-body-s text-ink-muted">
        {renderInline(task.payload.model_answer)}
      </p>
      <Source task={task} />
    </div>
  );
}

export const ROWS = {
  flashcard: flashcardRow,
  cloze: clozeRow,
  multiple_choice: multipleChoiceRow,
  open_question: openQuestionRow,
};

/* Every claim points at its source, on the table as much as on the card. */
function Source({ task }) {
  if (task.section_ordinal == null) return null;

  return (
    <p className="max-w-measure text-body-s text-ink-muted">
      From
      <CitationAnchor
        ordinal={task.section_ordinal}
        anchor={task.anchor}
        passage={task.passage}
        href={sectionHref(task)}
      />
    </p>
  );
}
