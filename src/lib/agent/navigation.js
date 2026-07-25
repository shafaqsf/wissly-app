import { isFormat } from './formats.js'

/**
 * The second level of reach: the agent drives the interface.
 *
 * "I made you eight cards" is worse than landing on them. So a tool returns an
 * **intent** — plain data naming a destination inside wissly — and the bar
 * performs it with the router it already has. Nothing here touches the DOM, and
 * nothing here can: the agent runs on the server, and the only thing that
 * crosses back is this object.
 *
 * The intent is a whitelist rather than a path, and that is the security
 * property. A tool that took a URL from the model would let a prompt injection
 * in an uploaded PDF choose where the learner's browser goes next — an
 * open redirect with the learner's session attached. Here the model chooses
 * between six named places and supplies ids, which are checked for being ids.
 *
 * `settings` is not among them, and neither is anything that exports or shares.
 * Auth and export stay out of the agent's reach, and "out of reach" has to
 * include navigating to them.
 */

/** The six places the agent may send the learner. Four areas, plus two leaves. */
export const NAVIGATION_TARGETS = Object.freeze([
  'dashboard',
  'courses',
  'course',
  'tasks',
  'due',
  'analytics',
])

/* An id, not a path. Uuids are what the database issues; the check is there to
 * stop `../..` rather than to validate a uuid, so it stays permissive about
 * shape and strict about characters. */
const ID = /^[\w-]{1,64}$/

function assertId(value, what) {
  if (!ID.test(String(value ?? ''))) {
    throw new Error(`"${value}" is not an id, so ${what} cannot be opened.`)
  }
}

const PATHS = {
  dashboard: () => '/dashboard',
  courses: () => '/courses',
  course: ({ courseId }) => {
    if (!courseId) throw new Error('Say which course to open.')
    assertId(courseId, 'the course')
    return `/courses/${courseId}`
  },
  tasks: () => '/tasks',
  due: () => '/tasks/due',
  analytics: () => '/analytics',
}

const LABELS = {
  dashboard: () => 'the dashboard',
  courses: () => 'your courses',
  course: () => 'the course',
  tasks: ({ format }) => (format ? `${format} tasks` : 'your tasks'),
  due: () => 'a review round',
  analytics: () => 'analytics',
}

/**
 * Build one navigation intent.
 *
 * @param {object} params
 * @param {string} params.target one of `NAVIGATION_TARGETS`
 * @param {string} [params.courseId] sets the course picker
 * @param {string} [params.format] opens a type
 * @param {string} [params.sourceId] applies the source filter
 * @param {string} [params.sectionId] applies the section filter
 * @param {string} [params.conceptId] opens analytics on one concept
 * @returns {{kind: 'navigate', path: string, query: Record<string, string>,
 *   label: string}}
 */
export function navigationIntent({
  target,
  courseId,
  format,
  sourceId,
  sectionId,
  conceptId,
} = {}) {
  if (!NAVIGATION_TARGETS.includes(target)) {
    throw new Error(
      `"${target}" cannot be opened. The agent moves around wissly — ${NAVIGATION_TARGETS.join(', ')} — and nowhere else.`,
    )
  }

  if (format != null && !isFormat(format)) {
    throw new Error(`"${format}" is not an artefact format.`)
  }

  for (const [value, what] of [
    [courseId, 'the course'],
    [sourceId, 'the source'],
    [sectionId, 'the passage'],
    [conceptId, 'the concept'],
  ]) {
    if (value != null && value !== '') assertId(value, what)
  }

  const path = PATHS[target]({ courseId })

  // The course id is in the path already when the course page is the
  // destination; repeating it in the query would be two truths about one thing.
  const query = {
    ...(courseId && target !== 'course' ? { course: courseId } : {}),
    ...(format ? { type: format } : {}),
    ...(sourceId ? { source: sourceId } : {}),
    ...(sectionId ? { section: sectionId } : {}),
    ...(conceptId ? { concept: conceptId } : {}),
  }

  return { kind: 'navigate', path, query, label: LABELS[target]({ format }) }
}
