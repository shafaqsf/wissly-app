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

/** A resolver that answers as if every hostname were this one public address. */
function publicLookup(address = '93.184.216.34') {
  return vi.fn(async () => ({ address, family: 4 }))
}

describe('fetchReadableText', () => {
  it('refuses anything that is not an http(s) address', async () => {
    await expect(fetchReadableText('not a url')).rejects.toThrow(FetchUrlError)
    await expect(fetchReadableText('ftp://example.com/file')).rejects.toThrow(/web address/)
  })

  it('fetches the page and returns its readable text and title', async () => {
    const fetchImpl = vi.fn(async () =>
      reply('<html><head><title>Refraction</title></head><body><article><p>Light bends.</p></article></body></html>'),
    )

    const result = await fetchReadableText('https://example.com/refraction', {
      fetch: fetchImpl,
      lookup: publicLookup(),
    })

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

    await expect(
      fetchReadableText('https://gone.example', { fetch: fetchImpl, lookup: publicLookup() }),
    ).rejects.toThrow(/Could not reach/)
  })

  it('reports a failing response by its status', async () => {
    const fetchImpl = vi.fn(async () => reply('not found', { status: 404 }))

    await expect(
      fetchReadableText('https://example.com/404', { fetch: fetchImpl, lookup: publicLookup() }),
    ).rejects.toThrow(/404/)
  })

  it('refuses a response that is not a web page', async () => {
    const fetchImpl = vi.fn(async () => reply('%PDF-1.4', { contentType: 'application/pdf' }))

    await expect(
      fetchReadableText('https://example.com/file.pdf', { fetch: fetchImpl, lookup: publicLookup() }),
    ).rejects.toThrow(/not a web page/)
  })

  it('refuses a page with no readable text on it', async () => {
    const fetchImpl = vi.fn(async () => reply('<html><body><nav>Menu only</nav></body></html>'))

    await expect(
      fetchReadableText('https://example.com/empty', { fetch: fetchImpl, lookup: publicLookup() }),
    ).rejects.toThrow(/no readable text/)
  })

  describe('SSRF', () => {
    it('refuses a hostname that resolves to the loopback address', async () => {
      const fetchImpl = vi.fn()

      await expect(
        fetchReadableText('http://localhost/', { fetch: fetchImpl, lookup: publicLookup('127.0.0.1') }),
      ).rejects.toThrow(/will not fetch/)
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('refuses the cloud instance-metadata address', async () => {
      const fetchImpl = vi.fn()

      await expect(
        fetchReadableText('http://metadata.internal/', {
          fetch: fetchImpl,
          lookup: publicLookup('169.254.169.254'),
        }),
      ).rejects.toThrow(/will not fetch/)
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it.each(['10.0.0.5', '172.16.0.5', '192.168.1.1', '0.0.0.1', '240.0.0.1'])(
      'refuses the private/reserved address %s',
      async (address) => {
        const fetchImpl = vi.fn()

        await expect(
          fetchReadableText('http://internal.example/', { fetch: fetchImpl, lookup: publicLookup(address) }),
        ).rejects.toThrow(/will not fetch/)
        expect(fetchImpl).not.toHaveBeenCalled()
      },
    )

    it('refuses an IPv6 loopback or link-local address', async () => {
      const fetchImpl = vi.fn()

      await expect(
        fetchReadableText('http://internal.example/', {
          fetch: fetchImpl,
          lookup: vi.fn(async () => ({ address: '::1', family: 6 })),
        }),
      ).rejects.toThrow(/will not fetch/)
      expect(fetchImpl).not.toHaveBeenCalled()
    })

    it('allows a public address through', async () => {
      const fetchImpl = vi.fn(async () => reply('<article><p>Fine.</p></article>'))

      await expect(
        fetchReadableText('https://example.com/', { fetch: fetchImpl, lookup: publicLookup('93.184.216.34') }),
      ).resolves.toMatchObject({ text: 'Fine.' })
    })

    it('re-checks a redirect target before following it', async () => {
      const lookup = vi.fn(async (hostname) => ({
        address: hostname === 'internal.example' ? '10.0.0.1' : '93.184.216.34',
        family: 4,
      }))
      const fetchImpl = vi.fn(async (requestUrl) =>
        requestUrl === 'https://public.example/'
          ? { ok: false, status: 302, headers: { get: (name) => (name === 'location' ? 'https://internal.example/' : null) } }
          : reply('<article><p>Should never be reached.</p></article>'),
      )

      await expect(
        fetchReadableText('https://public.example/', { fetch: fetchImpl, lookup }),
      ).rejects.toThrow(/will not fetch/)
      expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('gives up after too many redirects', async () => {
      const fetchImpl = vi.fn(async (requestUrl) => ({
        ok: false,
        status: 302,
        headers: {
          get: (name) => (name === 'location' ? `${requestUrl}/next` : null),
        },
      }))

      await expect(
        fetchReadableText('https://example.com/', { fetch: fetchImpl, lookup: publicLookup() }),
      ).rejects.toThrow(/redirected too many times/)
    })
  })
})
