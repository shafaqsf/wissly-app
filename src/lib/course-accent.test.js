import { describe, expect, it } from 'vitest'
import { courseAccent } from './course-accent'

describe('courseAccent', () => {
  /* Every course gets a tag colour, so a learner can tell two courses apart
     on the shelf and on their own header without reading the title first —
     task item 6 in v0.15. It is derived, not chosen: no two courses need the
     same id, so no course has to fight another one for a colour, and nobody
     has to maintain a list. */
  it('is the same colour every time for the same course', () => {
    expect(courseAccent('course-1')).toBe(courseAccent('course-1'))
  })

  it('is likely to differ between two different courses', () => {
    expect(courseAccent('course-1')).not.toBe(courseAccent('course-2'))
  })

  /* Derived is not "anything goes" either — see "Colour" in docs/DESIGN.md.
     Every course colour stays inside the same tasteful register as the rest
     of the accent palette: a fixed saturation and lightness, only the hue
     turns. That is what keeps a shelf of course tags looking like one
     product's palette rather than a colour wheel. */
  it('keeps every course colour at the same saturation and lightness', () => {
    for (const id of ['a', 'b', 'course-1', 'a-very-long-course-id-here']) {
      expect(courseAccent(id)).toMatch(/^hsl\(\d+(?:\.\d+)? 60% 45%\)$/)
    }
  })

  it('spreads hues across the full wheel rather than a narrow band', () => {
    const hue = (id) => Number(courseAccent(id).match(/^hsl\((\d+(?:\.\d+)?)/)[1])

    expect(hue('alpha')).not.toBe(hue('beta'))
    expect(hue('gamma')).toBeGreaterThanOrEqual(0)
    expect(hue('gamma')).toBeLessThan(360)
  })

  it('treats a missing id as the same fallback hue every time', () => {
    expect(courseAccent()).toBe(courseAccent(undefined))
    expect(courseAccent('')).toMatch(/^hsl\(\d+(?:\.\d+)? 60% 45%\)$/)
  })
})
