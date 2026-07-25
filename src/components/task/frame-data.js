import { TASK_FORMATS } from '@/lib/agent/formats.js'
import { listArtefacts } from '@/lib/data/artefacts.js'
import { listCourses } from '@/lib/data/courses.js'
import { dueArtefacts } from '@/lib/data/review.js'
import { listSourcesWithSections } from '@/lib/data/sources.js'

import { TASK_TYPES, typeByFormat } from './task-types.js'

/* What every task surface needs before it can draw its frame: the courses the
 * picker offers, and how many of each type there are under the course that is
 * being looked at.
 *
 * One read for all four types rather than four. The counts are a glance, and a
 * glance should not cost a query per row in the list beside it.
 */

/**
 * @param {object} supabase
 * @param {{courseId?: string}} params an empty course means every course
 * @returns {Promise<{courses: object[], counts: Record<string, number>,
 *   tasks: object[], sources: object[], courseName: string}>}
 */
export async function loadWorkbench(supabase, { courseId = '', archived = false } = {}) {
  const subjectId = courseId || undefined

  const [courses, tasks, sources, due] = await Promise.all([
    listCourses(supabase),
    listArtefacts(supabase, { subjectId, formats: TASK_FORMATS, archived }),
    listSourcesWithSections(supabase, { subjectId }),
    dueArtefacts(supabase, { subjectId }),
  ])

  const counts = { due: due.length }
  for (const type of TASK_TYPES) counts[type.slug] = 0

  // Archived rows are not what the left-hand counts are about: the list says
  // how much there is to work with, and an archived card is one the learner
  // has put away.
  const live = archived
    ? await listArtefacts(supabase, { subjectId, formats: TASK_FORMATS })
    : tasks

  for (const task of live) {
    const type = typeByFormat(task.format)
    if (type) counts[type.slug] += 1
  }

  return {
    courses,
    counts,
    tasks,
    sources,
    due,
    courseName: courses.find((course) => course.id === courseId)?.title ?? '',
  }
}
