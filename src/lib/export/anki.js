/* Flashcard and cloze artefacts, as Anki's plain-text importer reads them.
 *
 * Anki accepts a tab-separated `.txt` file with a handful of `#directive`
 * lines at the top (File → Import in the desktop app, or drag the file onto
 * the deck list) — no `.apkg`, no SQLite, no dependency. That is the format
 * this writes.
 *
 * **Why not true Anki Cloze notes.** Anki's plain-text importer applies one
 * note type to the whole file; there is no per-row `#notetype:` switch that
 * works across the versions still in wide use. Encoding wissly's cloze
 * artefacts as real `{{c1::…}}` deletions would need either a second file
 * (which fragments a five-card export into two imports) or a scheme that
 * only recent Anki reads. Both cloze and flashcard artefacts are written here
 * as plain **Basic** Front/Back rows instead: the cloze's blanked sentence is
 * the front, the missing term is the back. That keeps the two formats in one
 * file and one note type, and it is still a correct question/answer pair —
 * it forgoes only Anki's in-place blank-filling review style, not the
 * content.
 *
 * Reading formats (`summary`, `glossary`) are not recall and produce no
 * rows: there is nothing to rate yourself on for a paragraph you read.
 */

const RECALL_FORMATS = new Set(['flashcard', 'cloze']);

/** A field, made safe for one tab-separated line: no tabs, no line breaks. */
function field(text) {
  return String(text ?? '')
    .replace(/\t/g, '    ')
    .replace(/\r?\n/g, '<br>');
}

function rowFor(artefact) {
  if (artefact.format === 'flashcard') {
    return `${field(artefact.payload.front)}\t${field(artefact.payload.back)}`;
  }
  if (artefact.format === 'cloze') {
    return `${field(artefact.payload.text)}\t${field(artefact.payload.answer)}`;
  }
  return null;
}

/** @param {{courses: Array<{artefacts: Array<object>}>}} bundle */
export function bundleToAnkiText(bundle) {
  const rows = bundle.courses
    .flatMap((course) => course.artefacts ?? [])
    .filter((artefact) => RECALL_FORMATS.has(artefact.format))
    .map(rowFor);

  return ['#separator:tab', '#html:true', '#notetype:Basic', '#columns:Front,Back', ...rows].join(
    '\n',
  );
}

export function ankiFileName(bundle) {
  const title = bundle.courses.length === 1 ? bundle.courses[0].subject.title : 'wissly-export';

  const slug =
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'wissly-export';

  return `${slug}-anki.txt`;
}
