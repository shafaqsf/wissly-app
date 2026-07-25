/* Export, as two files a learner can actually open.

   Export is the one path that carries data out of the account, so it is a
   thing only the learner triggers, never a tool. That is why the whole of it is here, in the browser, over rows the page already
   holds: there is no endpoint for an agent to find.

   Two shapes, because they are read by two different things. CSV is for a
   spreadsheet. The Anki file is Anki's own plain-text import format, which is
   tab separated and carries its settings in `#` lines at the top — a real
   `.apkg` is a zip around a SQLite database, and shipping one would mean
   shipping a database engine to write two columns. */

/** RFC 4180: quote when the value holds a comma, a quote or a newline. */
function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function flashcardsAsCsv(tasks = []) {
  const rows = [
    ['Front', 'Back'],
    ...tasks.map((task) => [task.payload?.front ?? '', task.payload?.back ?? '']),
  ];

  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

/** Anki reads one card per line, so a newline inside a field has to go. */
function ankiCell(value) {
  return String(value ?? '')
    .replace(/\s*[\r\n]+\s*/g, ' ')
    .replace(/\t/g, ' ')
    .trim();
}

export function flashcardsAsAnki(tasks = []) {
  return [
    '#separator:tab',
    '#html:false',
    ...tasks.map((task) => `${ankiCell(task.payload?.front)}\t${ankiCell(task.payload?.back)}`),
  ].join('\n');
}

/** A filename a learner can find again, without a colon in it. */
export function exportFilename({ course, extension }) {
  const name = String(course || 'flashcards')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');

  return `${name || 'flashcards'}.${extension}`;
}
