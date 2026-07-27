import { describe, expect, it, vi } from 'vitest'

// `next/font/google` is a build-time transform; under the test runner it is
// an inert module, so the loaders have to be stood in for.
vi.mock('next/font/google', () => {
  const font = () => ({ variable: '--font-stub', className: 'font-stub' })
  return {
    Bricolage_Grotesque: font,
    Newsreader: font,
    JetBrains_Mono: font,
  }
})

import RootLayout, { metadata } from './layout'

import { MARK } from '@/components/brand/brand-mark'

/* Browser extensions write their own attributes onto `<body>` before React
   hydrates — a password manager, a colour picker, a reader mode. React sees
   markup it did not produce and reports a hydration mismatch that no change
   to this repository can fix. The tree below `<body>` stays checked; only
   the element the extensions touch is exempt. */
describe('the root layout', () => {
  it('exempts the body from the hydration check, where extensions write', () => {
    const body = RootLayout({ children: null }).props.children

    expect(body.type).toBe('body')
    expect(body.props.suppressHydrationWarning).toBe(true)
  })

  it('does not exempt the html element, which nothing should be touching', () => {
    const html = RootLayout({ children: null })

    expect(html.type).toBe('html')
    expect(html.props.suppressHydrationWarning).toBeUndefined()
  })

  /* One file is the mark: the browser tab and the agent point at the same
     asset, so the two can never drift apart. Declaring it here rather than
     through the app/icon file convention is what keeps it to one copy. */
  it('points the browser tab at the one brand mark', () => {
    expect(metadata.icons.icon).toBe(MARK)
    expect(metadata.icons.apple).toBe(MARK)
  })
})

/* Two screens moved when the six areas became four. A bookmark, a link in a
   note, an old tab — none of them may land on a 404. `/library` used to be
   among them, but v0.23.0 gives that address a new, unrelated meaning (the
   public course library) rather than repointing the redirect — see
   next.config.mjs. */
describe('the routes that moved', () => {
  it('sends every retired URL to the area that took it over', async () => {
    const { default: nextConfig } = await import('../../next.config.mjs')
    const redirects = await nextConfig.redirects()

    const map = Object.fromEntries(
      redirects.map((rule) => [rule.source, rule.destination]),
    )

    expect(map['/review']).toBe('/tasks/due')
    expect(map['/progress']).toBe('/analytics')
    expect(map['/library']).toBeUndefined()
  })

  /* Permanent, because these addresses are not coming back — the areas they
     named no longer exist. */
  it('makes them permanent', async () => {
    const { default: nextConfig } = await import('../../next.config.mjs')

    for (const rule of await nextConfig.redirects()) {
      expect(rule.permanent).toBe(true)
    }
  })
})
