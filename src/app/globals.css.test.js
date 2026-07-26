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

/* Every `.field-*` class in the stylesheet, as the fill it paints. A field is
   a mark now, and a mark is one flat dilution of ink. */
function fieldStates() {
  const states = new Map()

  for (const [, name, body] of css.matchAll(/\.field-([a-z]+)\s*\{([^}]*)\}/g)) {
    const fills = [
      ...body.matchAll(/--field-mark:\s*color-mix\(in srgb, var\((--color-ink)\) (\d+)%/g),
    ].map(([, colourToken, percent]) => ({
      hex: token(colourToken),
      alpha: Number(percent) / 100,
    }))

    states.set(name, fills)
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

/* Every `ellipse W% H% at X% Y%` in a rule, in the order it is painted. */
function geometry(selector) {
  const block = css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))
  if (!block) throw new Error(`No rule ${selector} in globals.css`)
  return [...block[1].matchAll(/ellipse\s+([\d.]+%\s+[\d.]+%\s+at\s+[\d.]+%\s+[\d.]+%)/g)].map(
    ([, shape]) => shape.replace(/\s+/g, ' '),
  )
}

describe('no field surface', () => {
  /* A field used to be a surface as well as a mark: three stops of ink bleeding
     in from the edges of a card, a whole panel or a whole heading tinted by how
     resolved the thing under it was. Grey behind a paragraph is a background —
     read as chrome whatever it was meant to encode — and it spent its whole
     life competing with the text sitting on top of it. See "The field" in
     docs/DESIGN.md. The state is worn as a mark, and only as a mark. */
  it('defines no surface class to paint one with', () => {
    expect(css).not.toMatch(/\.grain-field|\.grain-wash/)
  })

  it('paints no state as a gradient anywhere in the stylesheet', () => {
    expect(css).not.toMatch(/radial-gradient/)
    expect(css).not.toMatch(/--field-(near|far|floor)/)
  })

  it('is named by no component', () => {
    const offenders = sourceFiles().filter((file) =>
      /grain-field|grain-wash/.test(readFileSync(file, 'utf8')),
    )

    expect(offenders).toEqual([])
  })
})

describe('the field mark', () => {
  const mark = () => css.match(/\.grain-mark\s*\{([^}]*)\}/)?.[1] ?? ''

  it('is fully round', () => {
    expect(mark()).toMatch(/border-radius:\s*var\(--radius-round\);/)
  })

  /* A mark is what makes many-per-screen legible: a dozen radial fields down
     a list read as a texture pack, a dozen identical marks read as a legend.
     Give it geometry and it stops being a mark. */
  it('carries no radial geometry', () => {
    expect(geometry('.grain-mark')).toEqual([])
  })

  /* No paper core to protect the text, because a mark never holds text. The
     rule against muted ink on a field is about surfaces, not marks. */
  it('holds no text', () => {
    const offenders = sourceFiles()
      .filter((file) => file.endsWith('.jsx'))
      .filter((file) => /<[a-z]+[^>]*grain-mark[^>]*>[^<\s]/.test(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })
})

describe('the field palette', () => {
  /* The field itself did not get the accent. It is still ink at four
     dilutions, the same ink everything else on the page used to be drawn in
     before the chrome was allowed a palette — see "Colour" in docs/DESIGN.md.
     A `--color-field-*` token would let hue back into the one place the mark
     depends on staying legible as a *ratio* rather than a status light, so
     that token stays banned outright even though other hues are now allowed
     elsewhere in the stylesheet. */
  it('names no --color-field-* token anywhere in the stylesheet', () => {
    expect(css).not.toMatch(/--color-field-/)
  })

  /* Every `.field-*` fill still has to be ink, not accent and not the mastery
     gradient. The gradient is a layer beside the mark, never inside its own
     fill — see "the mastery gradient" below. */
  it('keeps every accent and mastery token out of a .field-* fill', () => {
    for (const [, body] of css.matchAll(/\.field-[a-z]+\s*\{([^}]*)\}/g)) {
      expect(body).not.toMatch(/--color-accent|--color-mastery-/)
    }
  })

  it('defines the three field states', () => {
    expect([...fieldStates().keys()].sort()).toEqual([
      'partial',
      'settled',
      'unresolved',
    ])
  })

  it('paints every state with exactly one fill', () => {
    for (const [name, fills] of fieldStates()) {
      expect(fills, `.field-${name}`).toHaveLength(1)
    }
  })

  /* Three dilutions two points apart are three shades of nothing at 12px.
     Filled, half and empty are a legend anyone can read down a column. */
  it('separates the three fills far enough to tell apart', () => {
    const alphas = [...fieldStates().values()].map(([fill]) => fill.alpha).sort()

    expect(alphas).toEqual([0, 0.45, 1])
  })
})

/* "No colour in the chrome" was a tested, documented rule: ink on paper, hue
   nowhere but the field. The maintainer has deliberately loosened it for the
   chrome — see "Colour" in docs/DESIGN.md — to make the product read as a
   product rather than a manuscript. "Deliberately loosened" is not "anything
   goes": every hue anywhere in the stylesheet still has to be one of a short,
   named list, nothing outside that list may define a colour, and dark mode is
   still out of scope. This block is what makes that survive contact with a
   deadline the same way the old rule did. */
describe('the accent palette', () => {
  const ACCENT_TOKENS = ['--color-accent', '--color-accent-soft', '--color-accent-deep']
  const MASTERY_TOKENS = ['--color-mastery-low', '--color-mastery-mid', '--color-mastery-high']
  const PALETTE_TOKENS = [...ACCENT_TOKENS, ...MASTERY_TOKENS]

  it('defines every palette token as a real hue', () => {
    for (const name of PALETTE_TOKENS) {
      const hex = token(name)
      const channels = new Set([hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)])
      expect(channels.size, name).toBeGreaterThan(1)
    }
  })

  /* Every coloured hex in the stylesheet has to be one of the palette's own
     values. A hue that is not one of these nine tokens is exactly the
     "anything goes" the maintainer ruled out. */
  it('names no hue in the stylesheet outside the defined palette', () => {
    const known = new Set(PALETTE_TOKENS.map((name) => token(name).toLowerCase()))

    const offenders = [...css.matchAll(/#([0-9a-fA-F]{6})\b/g)]
      .map(([, hex]) => `#${hex.toLowerCase()}`)
      .filter((hex) => {
        const isGrey = new Set([hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)]).size === 1
        return !isGrey && !known.has(hex)
      })

    expect(offenders).toEqual([])
  })

  it('still has no dark mode', () => {
    expect(css).not.toMatch(/prefers-color-scheme:\s*dark/)
  })
})

/* A second, deliberate colour layer beside the mark — never inside it, never
   a replacement for it. The mark keeps its grain and its fill; this reads the
   same three tiers `masteryState()` already names as a scale from red toward
   green, for a sighted learner scanning a column faster than grain alone
   lets them. See src/lib/mastery.js. */
describe('the mastery gradient', () => {
  /* The badge takes its colour from `--mastery-color`, which a component sets
     from `masteryState().color` — always one of the three mastery tokens, and
     never invented per component. The fallback keeps a `.mastery-gradient`
     with no state legible as the low end rather than transparent. */
  it('reads its colour from --mastery-color, defaulting to the low tier', () => {
    const rule = css.match(/\.mastery-gradient::after\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(rule).toMatch(/background-color:\s*var\(--mastery-color,\s*var\(--color-mastery-low\)\)/)
  })

  /* The gradient is a badge beside the mark's own geometry, not a shape of
     its own — the mark is still what carries the state's grain and fill. */
  it('is a small mark of its own, not a field surface', () => {
    const rule = css.match(/\.mastery-gradient::after\s*\{([^}]*)\}/)?.[1] ?? ''

    expect(rule).not.toMatch(/radial-gradient/)
    expect(css).not.toMatch(/\.mastery-gradient\s*\{[^}]*background-image:\s*radial-gradient/)
  })
})

describe('no text on a field', () => {
  /* This used to compute contrast: every stop overlapping at once, the darkest
     sample of the grain multiplied on top, and ink checked against that floor.
     Every rule about the field surface was a rule about contrast, which is a
     good sign the surface was in the wrong place. It is gone, so the question
     is not "is the ink readable on it" but "is there anything under the ink at
     all". There is not. */
  it('paints nothing under any text in any component', () => {
    const offenders = sourceFiles()
      .filter((file) => file.endsWith('.jsx'))
      .filter((file) => /grain-field|grain-wash/.test(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })

  /* A mark never holds text, so muted ink can never land on a fill. The rule
     that muted ink may not sit on a field survives as this: paper is the only
     thing text is ever set on, so `--ink-muted` keeps its 7:1 everywhere. */
  it('leaves paper as the only surface text is set on', () => {
    expect(css).not.toMatch(/\.grain-field|\.grain-wash/)

    const mark = css.match(/\.grain-mark\s*\{([^}]*)\}/)?.[1] ?? ''
    expect(mark).toMatch(/width:\s*0\.75rem/)
    expect(mark).toMatch(/height:\s*0\.75rem/)
  })
})

describe('the motion catalogue', () => {
  /* Motion is named, not improvised. Seven movements, each with a duration and
     a curve written down once — see "Motion" in docs/DESIGN.md. A component
     that needs movement reaches for one of these classes rather than inventing
     an eighth timing nobody agreed to. */
  const MOTION_TOKENS = [
    ['--motion-settle', '600ms'],
    ['--motion-drift', '8s'],
    ['--motion-stagger-step', '40ms'],
    ['--motion-flip', '300ms'],
    ['--motion-slide', '200ms'],
    ['--motion-lift', '120ms'],
    ['--motion-count', '400ms'],
  ]

  const MOTION_CLASSES = [
    '.motion-stagger',
    '.motion-flip',
    '.motion-slide',
    '.motion-lift',
    '.motion-count',
  ]

  it.each(MOTION_TOKENS)('defines %s as %s', (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`))
  })

  it('defines the settle curve once, as a token', () => {
    expect(css).toMatch(
      /--motion-settle-curve:\s*cubic-bezier\(0\.16,\s*1,\s*0\.3,\s*1\);/,
    )
  })

  it.each(MOTION_CLASSES)('defines %s', (selector) => {
    expect(css).toMatch(new RegExp(`\\${selector}(?![a-z-])[^{;]*\\{`))
  })

  /* The stagger stops at six. Past that a list is a queue and the offset reads
     as latency rather than as arrival. */
  it('stops the stagger at six items', () => {
    const stagger = css.match(/\.motion-stagger[\s\S]*?(?=\n\/\* ---)/)?.[0] ?? ''
    expect(stagger).toMatch(/nth-child\(-n \+ 6\)|nth-child\(n \+ 7\)/)
    expect(stagger).not.toMatch(/nth-child\(7\)/)
  })

  /* Reduced motion removes all of it. Not a shorter version, not a fainter
     one — the state change lands instantly and the information survives. */
  it('disables every movement under prefers-reduced-motion', () => {
    const reduced = css.match(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\n([\s\S]*?)\n\}\n/,
    )?.[1]

    expect(reduced).toBeTruthy()

    for (const selector of [...MOTION_CLASSES, '.grain-working::before', '.grain-mark']) {
      expect(reduced, selector).toContain(selector)
    }

    expect(reduced).toMatch(/animation:\s*none/)
    expect(reduced).toMatch(/transition:\s*none/)
  })

  /* Forbidden outright. A bounce or a spring says "look at me"; a parallax
     says the page is deeper than it is; autoplay takes the decision away. */
  it('names no forbidden movement anywhere in the stylesheet', () => {
    expect(css).not.toMatch(/bounce|spring|parallax|autoplay/i)
  })

  it('names no forbidden movement in any source file', () => {
    const offenders = sourceFiles().filter((file) =>
      /animate-bounce|motion-bounce|motion-spring|parallax|autoPlay|autoplay/i.test(
        readFileSync(file, 'utf8'),
      ),
    )

    expect(offenders).toEqual([])
  })
})

describe('colour containment', () => {
  /* The chrome may now use the accent and mastery palette, but only through
     the tokens `globals.css` defines once — a component reaches for
     `bg-accent` or `var(--color-mastery-low)`, the same way it already
     reaches for `bg-paper` or `text-ink`, and never writes a hex of its own.
     `globals.css` is the one file allowed to name a hue literally, because it
     is the one place the palette is defined; every other source file is
     still ink, paper and the tokens, exactly as before. */
  it('names no hue literally outside globals.css', () => {
    const offenders = sourceFiles()
      .filter((file) => !file.replace(/\\/g, '/').endsWith('src/app/globals.css'))
      .filter((file) => {
        const source = readFileSync(file, 'utf8')
        if (source.includes('--color-field-')) return true
        return [...source.matchAll(/#([0-9a-fA-F]{6})\b/g)].some(
          ([, hex]) =>
            new Set([hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((p) => p.toLowerCase()))
              .size > 1,
        )
      })

    expect(offenders).toEqual([])
  })

  /* `globals.css` itself keeps the same discipline as everywhere else: no
     `--color-field-*`, and the only hues it may define are the accent and
     mastery palette above. */
  it('names no --color-field- token in globals.css either', () => {
    expect(css).not.toMatch(/--color-field-/)
  })

  /* A header is a position on the page, not a state. A page-wide field band
     is how the field ended up describing the furniture rather than the
     subject — see "Where a field goes" in docs/DESIGN.md. */
  it('never turns a header into a field', () => {
    const offenders = sourceFiles()
      .filter((file) => file.endsWith('.jsx'))
      .filter((file) => /<header[^>]*grain-field/.test(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })

  /* The brand mark is the one coloured asset in the product, and it is a named
     exception rather than a loophole — see "The mark" in docs/DESIGN.md. One
     component owns the file; everything else composes that component, so the
     exception cannot quietly become a habit. */
  it('keeps the brand mark to the one component that owns it', () => {
    const offenders = sourceFiles()
      .filter((file) => !file.replace(/\\/g, '/').endsWith('components/brand/brand-mark.jsx'))
      .filter((file) => readFileSync(file, 'utf8').includes('/brand/icon'))

    expect(offenders).toEqual([])
  })

  /* Beside a form, never behind or below one. A form that reports its own
     progress wears a mark next to the words; a surface under the submit button
     is still a surface a learner is reading on. */
  it('never puts a field surface inside a form', () => {
    const offenders = sourceFiles()
      .filter((file) => file.endsWith('.jsx'))
      .filter((file) =>
        readFileSync(file, 'utf8')
          .split('<form')
          .slice(1)
          .some((rest) => rest.split('</form>')[0].includes('grain-field')),
      )

    expect(offenders).toEqual([])
  })

  /* Every field carries a state class. A `.grain-field` or `.grain-mark`
     without one paints transparent stops and silently loses the signal it was
     there to give. */
  it('never paints a field without a state', () => {
    const offenders = sourceFiles()
      .filter((file) => file.endsWith('.jsx'))
      .filter((file) =>
        readFileSync(file, 'utf8')
          .split('\n')
          .some(
            (line) =>
              (line.includes('grain-field') || line.includes('grain-mark')) &&
              !/field-(unresolved|partial|settled)|\$\{[a-z.]*field\}/i.test(line),
          ),
      )

    expect(offenders).toEqual([])
  })
})
