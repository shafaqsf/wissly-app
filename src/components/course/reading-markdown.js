import { describeAnchor } from '@/components/artefact/anchor';

/* Reading, out of the account and into a file the learner owns.
 *
 * Export is the one path that carries data out of wissly, so it is a thing
 * only the learner triggers — it is deliberately not an agent tool, and this
 * module is deliberately pure so that the whole of it can be tested without a
 * browser, a download or a request.
 *
 * Every entry keeps its anchor. A summary with the citation stripped out is a
 * paragraph of unattributed prose, which is the opposite of what this product
 * promises. */

function summaryBody(payload) {
  // Full depth, always. The three-sentence layer is a way of reading on a
  // screen; a file the learner keeps should hold everything that was written.
  return String(payload?.full ?? '').trim();
}

function entry(artefact) {
  const lines = [];

  if (artefact.format === 'glossary') {
    lines.push(`## ${artefact.payload?.term ?? 'Untitled'}`, '');
    lines.push(String(artefact.payload?.definition ?? '').trim(), '');
  } else {
    const ordinal = artefact.section_ordinal;
    lines.push(`## Section ${ordinal ?? '—'}`, '');
    lines.push(summaryBody(artefact.payload), '');
  }

  if (artefact.section_ordinal != null) {
    lines.push(`> Source ${artefact.section_ordinal} — ${describeAnchor(artefact.anchor)}`, '');
  }

  return lines;
}

export function readingToMarkdown({ title, artefacts = [] }) {
  const lines = [`# ${title}`, ''];

  if (artefacts.length === 0) {
    lines.push('No reading yet.', '');
    return lines.join('\n');
  }

  for (const artefact of artefacts) lines.push(...entry(artefact));

  return lines.join('\n');
}

/** A course title as a file name: lower case, hyphens, nothing exotic. */
export function readingFileName({ title }) {
  const slug =
    String(title ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'course';

  return `${slug}-reading.md`;
}
