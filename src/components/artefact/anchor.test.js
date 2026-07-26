import { describe, expect, it } from 'vitest'

import { describeAnchor, sectionHref } from './anchor'

describe('describeAnchor', () => {
  it('says "source unknown" when there is no anchor at all', () => {
    expect(describeAnchor(null)).toBe('source unknown')
    expect(describeAnchor(undefined)).toBe('source unknown')
  })

  it('describes a pdf anchor by its page', () => {
    expect(describeAnchor({ page: 12 })).toBe('page 12')
  })

  it('describes a pptx anchor by its slide', () => {
    expect(describeAnchor({ slide: 4 })).toBe('slide 4')
  })

  it('describes a pasted-text anchor by its character range', () => {
    expect(describeAnchor({ start: 10, end: 40 })).toBe('characters 10–40')
  })

  it('leads a pasted-text anchor with its heading, when it has one', () => {
    expect(describeAnchor({ start: 10, end: 40, heading: 'Snell' })).toBe(
      'Snell, characters 10–40',
    )
  })

  it('describes a web link or photo anchor the same way pasted text is — it was ingested the same way', () => {
    expect(describeAnchor({ start: 0, end: 20 })).toBe('characters 0–20')
  })
})

describe('sectionHref', () => {
  it('links to the section on its course shelf', () => {
    expect(sectionHref({ subject_id: 'course-1', section_id: 'sec-1' })).toBe(
      '/courses/course-1#section-sec-1',
    )
  })

  it('is undefined when the artefact names no course or section', () => {
    expect(sectionHref({})).toBeUndefined()
    expect(sectionHref({ subject_id: 'course-1' })).toBeUndefined()
  })
})
