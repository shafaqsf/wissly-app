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
 * once it is transcribed. All of those read as a place a person can find
 * again, so all of them get words rather than a raw offset.
 *
 * `{ generated: true, heading? }` is the one that does not: the section was
 * drafted by the agent from a stated goal rather than cut from anything the
 * learner brought — see `src/lib/agent/course-from-goal.js`. It must never be
 * worded as though it were a place. Confidently implying a source that does
 * not exist is the one failure this product cannot afford, so a generated
 * anchor says so in the same words every time rather than being left to look
 * like a passage citation that merely forgot its page number.
 */
export function describeAnchor(anchor) {
  if (!anchor) return 'source unknown';
  if (anchor.generated) {
    return anchor.heading
      ? `generated, not from your material — "${anchor.heading}"`
      : 'generated, not from your material';
  }
  if (anchor.page != null) return `page ${anchor.page}`;
  if (anchor.slide != null) return `slide ${anchor.slide}`;

  const range = `characters ${anchor.start}–${anchor.end}`;
  return anchor.heading ? `${anchor.heading}, ${range}` : range;
}

/** True when a passage was drafted by the agent rather than cut from source. */
export function isGeneratedAnchor(anchor) {
  return Boolean(anchor?.generated);
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
