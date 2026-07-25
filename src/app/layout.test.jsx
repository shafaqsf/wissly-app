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

import { existsSync } from 'node:fs'
import { join } from 'node:path'

import RootLayout, { metadata } from './layout'

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

  /* `app/icon.png` is a Next.js file convention: it emits the <link> tags on
     its own, with a content hash in the URL. The hash is the point — a static
     path under /public gets cached by the browser under the origin and an
     origin that once served a different icon keeps showing it. */
  it('leaves the tab icon to the file convention', () => {
    expect(existsSync(join(process.cwd(), 'src/app/icon.png'))).toBe(true)
    expect(metadata.icons).toBeUndefined()
  })
})
