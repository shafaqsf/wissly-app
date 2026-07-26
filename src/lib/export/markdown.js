import { describeAnchor } from '@/components/artefact/anchor';

/* The bundle `src/lib/data/export.js` gathers, read out loud.
 *
 * This is the sibling of `src/components/course/reading-markdown.js`, which
 * renders reading alone from what one course page already has loaded. This
 * one renders a whole bundle — sources, concepts, every artefact format, and
 * the review each one earned — the way a learner would actually read it back:
 * question first, answer after, nothing collapsed into a data structure a
 * person has to parse. */

function sourceBlock(source) {
  const lines = [`## ${source.title || 'Untitled'}`, ''];

  for (const section of source.sections ?? []) {
    lines.push(`### Section ${section.ordinal} — ${describeAnchor(section.anchor)}`, '');
    lines.push(section.content, '');
  }

  return lines;
}

function conceptBlock(concepts) {
  if (concepts.length === 0) return [];

  const lines = ['## Concepts', ''];
  for (const concept of concepts) {
    lines.push(`- **${concept.term}**${concept.definition ? ` — ${concept.definition}` : ''}`);
  }
  lines.push('');
  return lines;
}

/** One artefact, as prose — question, then answer, never the raw payload. */
function artefactBody(artefact) {
  const { format, payload } = artefact;

  if (format === 'flashcard') {
    return [`**Q:** ${payload.front}`, '', `**A:** ${payload.back}`];
  }

  if (format === 'cloze') {
    return [payload.text, '', `**Answer:** ${payload.answer}`];
  }

  if (format === 'multiple_choice') {
    const options = payload.options.map((option, index) =>
      index === payload.answer_index ? `- **${option}** (correct)` : `- ${option}`,
    );
    return [payload.stem, '', ...options];
  }

  if (format === 'open_question') {
    const criteria = (payload.criteria ?? []).map((point) => `- ${point}`);
    return [
      payload.prompt,
      '',
      `**A full-marks answer:** ${payload.model_answer}`,
      '',
      'What it has to cover:',
      ...criteria,
    ];
  }

  if (format === 'glossary') {
    return [`**${payload.term}**`, '', payload.definition];
  }

  // summary
  return [payload.full];
}

function reviewSummary(reviews, artefactId) {
  const own = reviews.filter((review) => review.artefact_id === artefactId);
  if (own.length === 0) return null;

  const latest = own[own.length - 1];
  const count = own.length;
  return `${count} review${count === 1 ? '' : 's'} — last rated ${latest.rating} of 4, next due ${latest.due_at ?? 'unscheduled'}`;
}

function artefactBlock(artefact, reviews) {
  const heading = artefact.section_ordinal != null ? `Section ${artefact.section_ordinal}` : 'Written by hand';
  const lines = [`### ${heading} — ${artefact.format}`, ''];

  lines.push(...artefactBody(artefact), '');

  if (artefact.anchor) {
    lines.push(`> ${describeAnchor(artefact.anchor)}`, '');
  }

  const summary = reviewSummary(reviews, artefact.id);
  if (summary) lines.push(`_${summary}_`, '');

  return lines;
}

function courseSection(course) {
  const { subject, sources, concepts, artefacts, reviews } = course;
  const lines = [`# ${subject.title}`, ''];

  const nothing = sources.length === 0 && concepts.length === 0 && artefacts.length === 0;
  if (nothing) {
    lines.push('Nothing has been added to this course yet.', '');
    return lines;
  }

  if (sources.length > 0) {
    lines.push('## Material', '');
    for (const source of sources) lines.push(...sourceBlock(source));
  }

  lines.push(...conceptBlock(concepts));

  if (artefacts.length > 0) {
    lines.push('## Reading and tasks', '');
    for (const artefact of artefacts) lines.push(...artefactBlock(artefact, reviews));
  }

  return lines;
}

export function bundleToMarkdown(bundle) {
  const lines = [];

  bundle.courses.forEach((course, index) => {
    if (index > 0) lines.push('---', '');
    lines.push(...courseSection(course));
  });

  return lines.join('\n');
}

/** A bundle's title as a file name: lower case, hyphens, nothing exotic. */
export function markdownFileName(bundle) {
  const title =
    bundle.courses.length === 1 ? bundle.courses[0].subject.title : 'wissly-export';

  const slug =
    String(title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'wissly-export';

  return `${slug}.md`;
}
