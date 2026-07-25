// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { NAVIGATION_TARGETS, navigationIntent } from './navigation.js'

describe('navigationIntent', () => {
  it('goes where a result landed', () => {
    expect(navigationIntent({ target: 'course', courseId: 'sub1' })).toMatchObject({
      kind: 'navigate',
      path: '/courses/sub1',
      query: {},
    })
  })

  it('sets the course picker and opens a type in one intent', () => {
    expect(
      navigationIntent({ target: 'tasks', courseId: 'sub1', format: 'flashcard' }),
    ).toMatchObject({
      kind: 'navigate',
      path: '/tasks',
      query: { course: 'sub1', type: 'flashcard' },
    })
  })

  it('applies a filter', () => {
    expect(
      navigationIntent({ target: 'tasks', sourceId: 'src1', sectionId: 's1' }),
    ).toMatchObject({ query: { source: 'src1', section: 's1' } })
  })

  it('starts a review round', () => {
    expect(navigationIntent({ target: 'due', courseId: 'sub1' })).toMatchObject({
      path: '/tasks/due',
      query: { course: 'sub1' },
    })
  })

  it('opens analytics on one concept', () => {
    expect(navigationIntent({ target: 'analytics', conceptId: 'c1' })).toMatchObject({
      path: '/analytics',
      query: { concept: 'c1' },
    })
  })

  it('carries a label, because the bar renders the intent before it performs it', () => {
    expect(navigationIntent({ target: 'due' }).label.length).toBeGreaterThan(3)
  })

  it('is data the bar performs, never a reach into the DOM', () => {
    const intent = navigationIntent({ target: 'courses' })

    expect(Object.keys(intent).sort()).toEqual(['kind', 'label', 'path', 'query'])
    expect(JSON.parse(JSON.stringify(intent))).toEqual(intent)
  })

  it('refuses a destination that is not one of the four areas', () => {
    expect(() => navigationIntent({ target: 'settings' })).toThrow(/cannot be opened/i)
    expect(() => navigationIntent({ target: '/etc/passwd' })).toThrow(/cannot be opened/i)
    expect(() => navigationIntent({ target: 'export' })).toThrow(/cannot be opened/i)
  })

  it('refuses a course page with no course, rather than inventing a path', () => {
    expect(() => navigationIntent({ target: 'course' })).toThrow(/which course/i)
  })

  it('will not smuggle a path through an id', () => {
    expect(() =>
      navigationIntent({ target: 'course', courseId: '../../settings' }),
    ).toThrow(/id/i)
  })

  it('rejects a format that is not one of the six', () => {
    expect(() => navigationIntent({ target: 'tasks', format: 'essay' })).toThrow(/format/i)
  })
})

describe('NAVIGATION_TARGETS', () => {
  it('names the four areas and nothing that carries data out of the account', () => {
    expect([...NAVIGATION_TARGETS].sort()).toEqual([
      'analytics',
      'course',
      'courses',
      'dashboard',
      'due',
      'tasks',
    ])
  })
})
