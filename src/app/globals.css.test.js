// @vitest-environment node

/* The field is the only place colour is allowed, and colour under text is the
   one way this change could quietly break the product. These tests read the
   stylesheet itself rather than a copy of its values, so they fail when the
   stylesheet drifts, not when someone forgets to update a fixture. */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('..', import.meta.url))

/* `fs.globSync` is still experimental and warns on every run. Walking the
   tree by hand is four lines and silent. */
function sourceFiles(dir = SRC, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) sourceFiles(path, found)
    else if (/\.(js|jsx|css)$/.test(entry.name) && !entry.name.includes('.test.'))
      found.push(path)
  }
  return found
}

const css = readFileSync(
  fileURLToPath(new URL('./globals.css', import.meta.url)),
  'utf8',
)

/* Which grain intensity each field state is painted with. This is the design
   contract from docs/DESIGN.md, and it belongs in the test because the worst
   case for contrast is the field *plus* its grain, never the field alone. */
const GRAIN_FOR_STATE = {
  unresolved: '--grain-3',
  partial: '--grain-2',
  settled: '--grain-0',
}

function token(name) {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`No token ${name} in globals.css`)
  return match[1]
}

function grain(name) {
  const match = css.match(new RegExp(`${name}:\\s*([0-9.]+)`))
  if (!match) throw new Error(`No token ${name} in globals.css`)
  return Number(match[1])
}

function rgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

/* Source-over: one translucent layer painted on what is already there. */
function over(base, layer, alpha) {
  return base.map((channel, i) => channel + alpha * (layer[i] - channel))
}

function luminance([r, g, b]) {
  const [lr, lg, lb] = [r, g, b].map((channel) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
}

function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/* Every `.field-*` class in the stylesheet, as the three stops it paints. */
function fieldStates() {
  const states = new Map()

  for (const [, name, body] of css.matchAll(/\.field-([a-z]+)\s*\{([^}]*)\}/g)) {
    const stops = [
      ...body.matchAll(
        /--field-(?:near|far|floor):\s*color-mix\(in srgb, var\((--color-field-[a-z]+)\) (\d+)%/g,
      ),
    ].map(([, colourToken, percent]) => ({
      hex: token(colourToken),
      alpha: Number(percent) / 100,
    }))

    states.set(name, stops)
  }

  return states
}

describe('shape', () => {
  /* Three steps, and only three. A radius that is written by hand somewhere in
     a component is a fourth step nobody agreed to. */
  it.each([
    ['--radius-control', '8px'],
    ['--radius-surface', '14px'],
    ['--radius-round', '9999px'],
  ])('defines %s as %s', (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`))
  })

  /* Tailwind turns the tokens into `rounded-control` / `rounded-surface` /
     `rounded-round`. Naming the variable directly bypasses that and gives two
     spellings for one idea, which is how the old stylesheet drifted. */
  it('never names a radius token outside globals.css', () => {
    const offenders = sourceFiles()
      .filter((file) => !file.replace(/\\/g, '/').endsWith('src/app/globals.css'))
      .filter((file) => readFileSync(file, 'utf8').includes('--radius-'))

    expect(offenders).toEqual([])
  })

  /* The grain layer is an `inset: 0` pseudo-element. On a rounded surface it
     paints square corners over the parent's rounded ones unless it is told to
     follow them. */
  it('lets the grain layer follow the corner it sits in', () => {
    const layer = css.match(/\.grain::before\s*\{([^}]*)\}/)
    expect(layer?.[1]).toMatch(/border-radius:\s*inherit;/)
  })
})

describe('the field palette', () => {
  it('defines all five field tokens', () => {
    for (const name of ['hot', 'deep', 'warm', 'mid', 'cool']) {
      expect(() => token(`--color-field-${name}`)).not.toThrow()
    }
  })

  it('defines the three field states', () => {
    expect([...fieldStates().keys()].sort()).toEqual([
      'partial',
      'settled',
      'unresolved',
    ])
  })

  it('paints every state with three stops', () => {
    for (const [name, stops] of fieldStates()) {
      expect(stops, `.field-${name}`).toHaveLength(3)
    }
  })
})

describe('text on a field', () => {
  /* The worst case is every stop overlapping at once, then the darkest point
     of the grain multiplied on top. No real pixel is this dark; if ink clears
     4.5:1 here it clears it everywhere. */
  it.each(Object.keys(GRAIN_FOR_STATE))(
    'keeps ink readable on .field-%s at its darkest point',
    (state) => {
      const stops = fieldStates().get(state)
      const grainOpacity = grain(GRAIN_FOR_STATE[state])

      // Painted floor first, near last — the order the stylesheet stacks them.
      const composited = [...stops]
        .reverse()
        .reduce((base, stop) => over(base, rgb(stop.hex), stop.alpha), rgb(token('--color-paper')))

      // Grain is `mix-blend-mode: multiply` over greyscale noise. Its darkest
      // sample is black, so the floor is the field scaled by the opacity.
      const darkest = composited.map((channel) => channel * (1 - grainOpacity))

      expect(contrast(darkest, rgb(token('--color-ink')))).toBeGreaterThanOrEqual(4.5)
    },
  )

  /* Catches the common shape: both classes on one element. Text nested one
     level down inside a field is checked where it is rendered — see
     panel.test.jsx and concept-mastery.test.jsx. */
  it('never lets muted ink sit on a field', () => {
    const offenders = sourceFiles()
      .filter((file) => file.endsWith('.jsx'))
      .filter((file) =>
        /grain-field[^"'`]*text-ink-muted|text-ink-muted[^"'`]*grain-field/.test(
          readFileSync(file, 'utf8'),
        ),
      )

    expect(offenders).toEqual([])
  })
})

describe('colour containment', () => {
  /* Atmosphere only: the field tokens exist so that colour cannot leak into
     the chrome. globals.css is the only file allowed to name one. */
  it('keeps every field token inside globals.css', () => {
    const offenders = sourceFiles()
      .filter((file) => !file.replace(/\\/g, '/').endsWith('src/app/globals.css'))
      .filter((file) => readFileSync(file, 'utf8').includes('--color-field-'))

    expect(offenders).toEqual([])
  })

  /* Every field carries a state class. A `.grain-field` without one paints
     transparent stops and silently loses the signal it was there to give. */
  it('never paints a field without a state', () => {
    const offenders = sourceFiles()
      .filter((file) => file.endsWith('.jsx'))
      .filter((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .some(
            (line) =>
              line.includes('grain-field') &&
              !/field-(unresolved|partial|settled)|\$\{[a-z.]*field\}/i.test(line),
          ),
      )

    expect(offenders).toEqual([])
  })
})
