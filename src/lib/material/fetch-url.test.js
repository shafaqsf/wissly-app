// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import {
  FetchUrlError,
  fetchReadableText,
  makeGuardedLookup,
  readableTextFromHtml,
} from './fetch-url.js'

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

  /* The ceiling has to bite while the body is arriving, not after it has all
     been held in memory — otherwise it is a report, not a limit. */
  describe('the size ceiling', () => {
    /** A response that streams `chunkCount` chunks of `chunkSize` bytes. */
    function streamingReply(chunkCount, chunkSize) {
      let sent = 0
      const cancelled = { yes: false }

      return {
        response: {
          ok: true,
          status: 200,
          headers: { get: () => 'text/html' },
          body: {
            getReader: () => ({
              read: async () =>
                sent++ < chunkCount
                  ? { done: false, value: new Uint8Array(chunkSize) }
                  : { done: true, value: undefined },
              cancel: async () => {
                cancelled.yes = true
              },
            }),
          },
          text: async () => {
            throw new Error('the streaming path should not fall back to text()')
          },
        },
        cancelled,
        sentChunks: () => sent,
      }
    }

    it('stops reading a body once it passes the ceiling, rather than buffering it all first', async () => {
      const { response, cancelled, sentChunks } = streamingReply(1000, 1024)

      await expect(
        fetchReadableText('https://example.com/huge', {
          fetch: async () => response,
          lookup: publicLookup(),
          maxBytes: 4096,
        }),
      ).rejects.toThrow(/too large/)

      expect(cancelled.yes).toBe(true)
      // Five 1KiB chunks is enough to pass a 4KiB ceiling; it must not have
      // read on to the thousandth.
      expect(sentChunks()).toBeLessThan(10)
    })

    it('reads a body that stays under the ceiling', async () => {
      const html = '<article><p>Small enough.</p></article>'
      const encoded = new TextEncoder().encode(html)
      let sent = false

      const result = await fetchReadableText('https://example.com/small', {
        fetch: async () => ({
          ok: true,
          status: 200,
          headers: { get: () => 'text/html' },
          body: {
            getReader: () => ({
              read: async () =>
                sent ? { done: true } : ((sent = true), { done: false, value: encoded }),
              cancel: async () => {},
            }),
          },
        }),
        lookup: publicLookup(),
        maxBytes: 4096,
      })

      expect(result.text).toBe('Small enough.')
    })

    it('measures bytes rather than characters, so multi-byte text cannot slip past', async () => {
      // 3 bytes each in UTF-8, so 40 of them are 120 bytes against a 100-byte
      // ceiling — but only 40 characters, which a `.length` check would pass.
      const body = '→'.repeat(40)

      await expect(
        fetchReadableText('https://example.com/wide', {
          fetch: async () => reply(body),
          lookup: publicLookup(),
          maxBytes: 100,
        }),
      ).rejects.toThrow(/too large/)
    })
  })
})

/* The pre-flight check approves an address; this is what the socket actually
   resolves with. If the two can disagree, the guard is advisory — a name that
   answers publicly once and privately a moment later would walk straight
   past it. */
describe('guardedLookup', () => {
  /** Run the guard against a canned resolver answer. */
  function resolveWith(answer, { hostname = 'example.test', options = {} } = {}) {
    const lookup = makeGuardedLookup((_name, _options, callback) =>
      Array.isArray(answer)
        ? callback(null, answer)
        : callback(null, answer.address, answer.family),
    )

    return new Promise((resolve) => {
      lookup(hostname, options, (error, address, family) =>
        resolve({ error, address, family }),
      )
    })
  }

  it('passes a public address through untouched', async () => {
    const { error, address, family } = await resolveWith({
      address: '93.184.216.34',
      family: 4,
    })

    expect(error).toBeFalsy()
    expect(address).toBe('93.184.216.34')
    expect(family).toBe(4)
  })

  it('refuses a name that resolves into a private range', async () => {
    const { error } = await resolveWith({ address: '10.1.2.3', family: 4 })

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/will not fetch/)
  })

  it('refuses a name that resolves to the metadata endpoint', async () => {
    const { error } = await resolveWith({ address: '169.254.169.254', family: 4 })

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/will not fetch/)
  })

  it('refuses when any entry of an all:true answer is private', async () => {
    const { error } = await resolveWith(
      [
        { address: '93.184.216.34', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
      { options: { all: true } },
    )

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toMatch(/will not fetch/)
  })

  it('passes an all:true answer whose every entry is public', async () => {
    const { error, address } = await resolveWith(
      [
        { address: '93.184.216.34', family: 4 },
        { address: '2606:2800:220:1::', family: 6 },
      ],
      { options: { all: true } },
    )

    expect(error).toBeFalsy()
    expect(address).toEqual([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:2800:220:1::', family: 6 },
    ])
  })

  it('passes a resolver failure straight back, rather than reading it as approval', async () => {
    const lookup = makeGuardedLookup((_name, _options, callback) =>
      callback(new Error('ENOTFOUND')),
    )

    const error = await new Promise((resolve) =>
      lookup('gone.test', {}, (err) => resolve(err)),
    )

    expect(error.message).toBe('ENOTFOUND')
  })
})
