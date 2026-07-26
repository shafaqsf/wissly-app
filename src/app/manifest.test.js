// @vitest-environment node

import { describe, expect, it } from 'vitest'

import manifest from './manifest.js'

describe('the web app manifest', () => {
  it('names the product and opens straight into the dashboard', () => {
    const result = manifest()

    expect(result.name).toBe('wissly')
    expect(result.start_url).toBe('/dashboard')
    expect(result.display).toBe('standalone')
  })

  it('points at the one brand mark, not a second icon set', () => {
    const result = manifest()

    expect(result.icons).toEqual([{ src: '/brand/icon.png', sizes: 'any', type: 'image/png' }])
  })
})
