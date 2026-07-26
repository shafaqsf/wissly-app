import { TASK_FORMATS } from '@/lib/agent/formats'

/* The four types the workbench is built out of, and the words the learner
 * reads for them.
 *
 * `format` is the column; `slug` is the address; `label` is what the left-hand
 * list says and `one` is what a single card calls itself. The word "artefact"
 * appears in none of them — it is a table, not a thing anybody is learning.
 *
 * The order is `TASK_FORMATS`, so the list on the left and the split in
 * `src/lib/agent/formats.js` cannot drift apart. */

export const TASK_TYPES = Object.freeze([
  { slug: 'flashcards', format: 'flashcard', label: 'Flashcards', one: 'Flashcard' },
  { slug: 'cloze', format: 'cloze', label: 'Cloze', one: 'Cloze' },
  {
    slug: 'multiple-choice',
    format: 'multiple_choice',
    label: 'Multiple choice',
    one: 'Multiple choice',
  },
  {
    slug: 'open-questions',
    format: 'open_question',
    label: 'Open questions',
    one: 'Open question',
  },
  { slug: 'ordering', format: 'ordering', label: 'Ordering', one: 'Ordering' },
  {
    slug: 'practice-exams',
    format: 'practice_exam',
    label: 'Practice exams',
    one: 'Practice exam',
  },
].sort((a, b) => TASK_FORMATS.indexOf(a.format) - TASK_FORMATS.indexOf(b.format)))

export function typeBySlug(slug) {
  return TASK_TYPES.find((type) => type.slug === slug)
}

export function typeByFormat(format) {
  return TASK_TYPES.find((type) => type.format === format)
}

/** What one card of each format is called, for the label above it. */
export const FORMAT_NAMES = Object.freeze(
  Object.fromEntries(TASK_TYPES.map((type) => [type.format, type.one])),
)
