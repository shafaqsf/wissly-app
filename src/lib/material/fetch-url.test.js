// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { FetchUrlError, fetchReadableText, readableTextFromHtml } from './fetch-url.js'

/** A response the way `fetch` hands it back. */
function reply(body, { status = 200, contentType = 'text/html; charset=utf-8' } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  }
}

describe('readableTextFromHtml', () => {
  it('keeps the paragraphs of an article and drops the chrome around them', () => {
    const html = `
      <html><head><title>Refraction</title></head>
      <body>
        <nav>Skip to content</nav>
        <header>wissly.example</header>
        <article>
          <h1>Refraction</h1>
          <p>Light bends at a boundary.</p>
          <p>The angle follows a law.</p>
        </article>
        <footer>© wissly</footer>
        <script>track()</script>
      </body></html>`

    const { title, text } = readableTextFromHtml(html)

    expect(title).toBe('Refraction')
    expect(text).toContain('Light bends at a boundary.')
    expect(text).toContain('The angle follows a law.')
    expect(text).not.toContain('Skip to content')
    expect(text).not.toContain('wissly.example')
    expect(text).not.toContain('track()')
  })

  it('turns a heading into a markdown heading, so the rest of ingestion still finds it', () => {
    const html = '<article><h2>Snell’s law</h2><p>The angle follows a law.</p></article>'

    const { text } = readableTextFromHtml(html)

    expect(text).toMatch(/^## /m)
  })

  it('decodes named and numeric entities', () => {
    const html = '<article><p>Caf&#233; &mdash; tea &amp; biscuits.</p></article>'

    const { text } = readableTextFromHtml(html)

    expect(text).toBe('Café — tea & biscuits.')
  })

  it('falls back to the whole body when there is no article or main', () => {
    const html = '<html><body><p>Just a paragraph.</p></body></html>'

    const { text } = readableTextFromHtml(html)

    expect(text).toBe('Just a paragraph.')
  })
})

describe('fetchReadableText', () => {
  it('refuses anything that is not an http(s) address', async () => {
    await expect(fetchReadableText('not a url')).rejects.toThrow(FetchUrlError)
    await expect(fetchReadableText('ftp://example.com/file')).rejects.toThrow(/web address/)
  })

  it('fetches the page and returns its readable text and title', async () => {
    const fetchImpl = vi.fn(async () =>
      reply('<html><head><title>Refraction</title></head><body><article><p>Light bends.</p></article></body></html>'),
    )

    const result = await fetchReadableText('https://example.com/refraction', { fetch: fetchImpl })

    expect(result).toEqual({
      title: 'Refraction',
      text: 'Light bends.',
      url: 'https://example.com/refraction',
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/refraction',
      expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': expect.any(String) }) }),
    )
  })

  it('reports an address it could not reach', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND')
    })

    await expect(fetchReadableText('https://gone.example', { fetch: fetchImpl })).rejects.toThrow(
      /Could not reach/,
    )
  })

  it('reports a failing response by its status', async () => {
    const fetchImpl = vi.fn(async () => reply('not found', { status: 404 }))

    await expect(fetchReadableText('https://example.com/404', { fetch: fetchImpl })).rejects.toThrow(
      /404/,
    )
  })

  it('refuses a response that is not a web page', async () => {
    const fetchImpl = vi.fn(async () => reply('%PDF-1.4', { contentType: 'application/pdf' }))

    await expect(fetchReadableText('https://example.com/file.pdf', { fetch: fetchImpl })).rejects.toThrow(
      /not a web page/,
    )
  })

  it('refuses a page with no readable text on it', async () => {
    const fetchImpl = vi.fn(async () => reply('<html><body><nav>Menu only</nav></body></html>'))

    await expect(fetchReadableText('https://example.com/empty', { fetch: fetchImpl })).rejects.toThrow(
      /no readable text/,
    )
  })
})
