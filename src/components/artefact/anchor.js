/* Where a passage is, in words, and where it lives, as a URL.
 *
 * Both of these are plain functions and both are needed on the server — the
 * course shelf renders every section's anchor without hydrating anything. They
 * sit outside `citation-anchor.jsx` for exactly that reason: a value imported
 * from a `'use client'` module into a server component arrives as a client
 * reference, and calling it throws. `citation-anchor.jsx` re-exports both, so
 * nothing that already imports them from there has to change. */

/**
 * An anchor is `{ page }` for a PDF, `{ slide }` for a slide deck, or
 * `{ start, end, heading? }` for anything ingested like pasted text — pasted
 * text itself, a web link once it is reduced to readable prose, or a photo
 * once it is transcribed. All three read as a place a person can find again,
 * so all three get words rather than a raw offset.
 */
export function describeAnchor(anchor) {
  if (!anchor) return 'source unknown';
  if (anchor.page != null) return `page ${anchor.page}`;
  if (anchor.slide != null) return `slide ${anchor.slide}`;

  const range = `characters ${anchor.start}–${anchor.end}`;
  return anchor.heading ? `${anchor.heading}, ${range}` : range;
}

/**
 * Where a cited section lives: on its course shelf, at its own id.
 *
 * The shelf renders every section with `id="section-<id>"`, so this is the one
 * destination that exists for a passage and the one place the URL is spelled.
 * Returns undefined when the artefact names no course or no section — an
 * anchor with nowhere to go still opens its passage.
 */
export function sectionHref(artefact) {
  const course = artefact?.subject_id;
  const section = artefact?.section_id;

  if (!course || !section) return undefined;

  return `/courses/${course}#section-${section}`;
}
