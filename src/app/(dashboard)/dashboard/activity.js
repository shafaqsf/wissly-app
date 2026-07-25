/* Turning one recorded write into a sentence and a destination.

   "What the agent changed" is a list of writes the learner may not have
   watched, so every row has to say what happened in the learner's words and
   lead to where it landed. A tool name is not a sentence, and a row that
   cannot be followed is a notification rather than an entrance.

   `artefact` is the table's word and never the interface's. A generation of
   an unknown format is "tasks", not "artefacts". */

/** Plurals of the six formats, as a learner counts them. */
const FORMAT_PLURALS = {
  summary: ['summary', 'summaries'],
  glossary: ['glossary entry', 'glossary entries'],
  flashcard: ['flashcard', 'flashcards'],
  cloze: ['cloze', 'cloze'],
  multiple_choice: ['multiple choice question', 'multiple choice questions'],
  open_question: ['open question', 'open questions'],
};

function counted(count, format) {
  const [one, many] = FORMAT_PLURALS[format] ?? ['task', 'tasks'];
  return `${count} ${count === 1 ? one : many}`;
}

export function describeAction(action) {
  const args = action?.args ?? {};

  switch (action?.tool) {
    case 'make_artefacts':
      return `Made ${counted(Number(args.count) || 0, args.format)} from your material`;
    case 'rename_course':
      return `Renamed a course to “${args.title}”`;
    default:
      // A tool this file has not met yet. Its name is at least true, which a
      // guessed sentence would not be.
      return String(action?.tool ?? 'Something changed');
  }
}

export function destinationOf(action) {
  const args = action?.args ?? {};

  switch (action?.tool) {
    case 'make_artefacts':
      return '/tasks';
    case 'rename_course':
      return `/courses/${args.courseId}`;
    default:
      return '/courses';
  }
}
