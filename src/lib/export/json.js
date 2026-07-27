/* The full-fidelity export: the bundle `src/lib/data/export.js` gathers,
 * unchanged. This is what `src/lib/import/json.js` reads back, and is the
 * one export format that round-trips — Markdown and the Anki text are read
 * by a person or by Anki, never by wissly itself. */

export function bundleToJson(bundle) {
  return JSON.stringify(bundle, null, 2);
}

/** A bundle's title as a file name: lower case, hyphens, nothing exotic. */
export function jsonFileName(bundle) {
  const title = bundle.courses.length === 1 ? bundle.courses[0].subject.title : 'wissly-export';

  const slug =
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'wissly-export';

  return `${slug}.json`;
}
