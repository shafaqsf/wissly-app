import 'server-only'
import { lookup as dnsLookupCallback } from 'node:dns'
import { lookup as dnsLookup } from 'node:dns/promises'
import { Agent } from 'undici'

/**
 * Web link import — fetch a page server-side and reduce it to the readable
 * prose the rest of ingestion already knows how to cut into sections.
 *
 * This is deliberately not `@mozilla/readability` + `jsdom`: that pair is the
 * thorough way to do this and a heavy one, a full DOM built just to throw
 * most of it away. A regex pass that drops the tags a reader would never
 * read — script, style, nav, header, footer — and turns block boundaries
 * into blank lines before stripping the rest gets the same material to
 * `sectionsFromText`, which is the part that actually has to be right.
 *
 * Server only, like `openrouter.js`: this makes an outbound request on the
 * learner's behalf, and the same shape of error handling applies — a clear,
 * actionable message rather than a raw fetch failure.
 */

/** A page this large is not an article any more. */
const MAX_BYTES = 5 * 1024 * 1024
const FETCH_TIMEOUT_MS = 15000
const MAX_REDIRECTS = 5

export class FetchUrlError extends Error {
  constructor(message, { cause } = {}) {
    super(message, { cause })
    this.name = 'FetchUrlError'
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * SSRF guard. The learner's browser never makes this request — the server
 * does, on their behalf — so "any http(s) address" is not a safe thing to
 * hand to `fetch`: it would let an address on the private network, or a
 * cloud provider's instance-metadata endpoint (169.254.169.254 and its
 * IPv6 equivalents), be read back through a feature that was only ever
 * meant to import an article. Every hostname is resolved and checked before
 * it is fetched, and every redirect hop is checked again before it is
 * followed — a public hostname redirecting to a private address is the same
 * attack one step later.
 */
function isBlockedIPv4(address) {
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true
  }
  const [a, b] = octets
  if (a === 0) return true // "this network"
  if (a === 10) return true // RFC 1918
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local — includes cloud instance metadata
  if (a === 172 && b >= 16 && b <= 31) return true // RFC 1918
  if (a === 192 && b === 168) return true // RFC 1918
  if (a >= 224) return true // multicast and reserved
  return false
}

function isBlockedIPv6(address) {
  const normalized = address.toLowerCase()
  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('::ffff:')) return isBlockedIPv4(normalized.slice(7))
  if (/^fe[89ab]/.test(normalized)) return true // fe80::/10, link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true // fc00::/7, unique local
  return false
}

function isBlockedAddress(address, family) {
  return family === 6 ? isBlockedIPv6(address) : isBlockedIPv4(address)
}

/** @param {string} url @param {typeof dnsLookup} lookup */
async function assertPublicHost(url, lookup) {
  const { hostname } = new URL(url)

  let resolved
  try {
    resolved = await lookup(hostname)
  } catch (cause) {
    throw new FetchUrlError(`Could not reach ${url}. Check the address and try again.`, { cause })
  }

  if (isBlockedAddress(resolved.address, resolved.family)) {
    throw new FetchUrlError(`${url} points at an address wissly will not fetch.`)
  }
}

/**
 * The same check again, at the moment the socket is opened.
 *
 * `assertPublicHost` resolves the name and approves an address, and then
 * `fetch` resolves the name a second time, independently, to decide where to
 * connect. A name whose answer differs between those two lookups — a short
 * TTL, a resolver the attacker controls — is approved on one address and
 * connected on another, which is the whole guard undone. This closes the
 * window by making the connection run the check itself: undici calls this
 * instead of `dns.lookup`, so the address that is approved is by construction
 * the address that is used.
 *
 * The earlier check stays. It is the one that still runs when a caller
 * injects its own `fetch` (every test does), and it fails a blocked address
 * before a socket is opened rather than during.
 *
 * The resolver is a parameter so the check can be tested without a real name
 * that resolves the way a test needs; undici only ever calls the bound
 * `guardedLookup` below.
 *
 * @param {typeof dnsLookupCallback} resolve
 */
export function makeGuardedLookup(resolve) {
  return function guarded(hostname, options, callback) {
    resolve(hostname, options, (error, address, family) => {
      if (error) return callback(error)

      // `all: true` answers with a list; anything private in it is a refusal,
      // because the connector is free to try any entry.
      const entries = Array.isArray(address) ? address : [{ address, family }]

      for (const entry of entries) {
        if (isBlockedAddress(entry.address, entry.family)) {
          return callback(
            new Error(`${hostname} resolves to an address wissly will not fetch.`),
          )
        }
      }

      return callback(null, address, family)
    })
  }
}

export const guardedLookup = makeGuardedLookup(dnsLookupCallback)

/* One dispatcher for the whole module: undici pools connections per agent, and
   a new one per request would throw that away. */
const guardedAgent = new Agent({ connect: { lookup: guardedLookup } })

const BLOCK_TAGS = ['script', 'style', 'noscript', 'template', 'svg', 'nav', 'header', 'footer', 'aside', 'form']

function stripElements(html, tag) {
  return html.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ')
}

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
}

/** @param {string} text */
function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(
      /&(amp|lt|gt|quot|apos|nbsp|mdash|ndash|hellip|rsquo|lsquo|rdquo|ldquo);/g,
      (_match, name) => NAMED_ENTITIES[name],
    )
}

/**
 * Reduce a page's HTML down to a title and its readable prose.
 *
 * Block boundaries (`<p>`, `<div>`, list items, headings, …) become blank
 * lines — or, for a heading, a markdown `##` — before any tag is stripped, so
 * `sectionsFromText` still finds the paragraph and heading boundaries it
 * splits on instead of one run-on line.
 *
 * @param {string} html
 * @returns {{title: string, text: string}}
 */
export function readableTextFromHtml(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, ' ').trim() : ''

  let body = html
  for (const tag of BLOCK_TAGS) body = stripElements(body, tag)

  // An <article> or a <main> is the page telling us where the content is;
  // prefer it over the whole body when it exists.
  const scoped = body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i) ?? body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  if (scoped) body = scoped[1]

  body = body
    .replace(/<h[1-6]\b[^>]*>/gi, '\n\n## ')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<(?:p|div|li|tr|blockquote|br)\b[^>]*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|tr|blockquote)>/gi, '\n')

  const text = decodeEntities(body.replace(/<[^>]+>/g, ' '))
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n')

  return { title, text }
}

/**
 * Read a response body, giving up as soon as it passes `maxBytes` rather than
 * after.
 *
 * `await response.text()` buffers the whole body first and only then measures
 * it, so the limit protected nothing that mattered: a page — or an endpoint
 * pretending to be one — that streams gigabytes has already been held in this
 * process's memory by the time the check runs. Reading in chunks and
 * cancelling mid-stream makes the ceiling real.
 *
 * `Content-Length` is not trusted for this: it is a claim by the server being
 * fetched, and the whole point here is that the server is not trusted.
 *
 * Falls back to `.text()` when the response carries no readable stream —
 * which is every response the tests hand in.
 */
async function readCapped(response, maxBytes, where) {
  const tooLarge = () => new FetchUrlError(`${where} is too large a page to import.`)
  const reader = response.body?.getReader?.()

  if (!reader) {
    const text = await response.text()
    if (Buffer.byteLength(text, 'utf8') > maxBytes) throw tooLarge()
    return text
  }

  const chunks = []
  let total = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw tooLarge()
    }
    chunks.push(value)
  }

  return new TextDecoder('utf-8').decode(Buffer.concat(chunks))
}

/**
 * Fetch a URL and reduce it to readable text, ready for `ingestSource({kind:
 * 'url', text })`.
 *
 * @param {string} url
 * @param {{fetch?: typeof fetch, lookup?: typeof dnsLookup, maxBytes?: number, timeoutMs?: number}} [options]
 * @returns {Promise<{title: string, text: string, url: string}>}
 */
export async function fetchReadableText(
  url,
  {
    fetch: fetchImpl = globalThis.fetch,
    lookup = dnsLookup,
    maxBytes = MAX_BYTES,
    timeoutMs = FETCH_TIMEOUT_MS,
  } = {},
) {
  const trimmed = String(url ?? '').trim()
  if (!isHttpUrl(trimmed)) {
    throw new FetchUrlError(
      `"${trimmed}" is not a web address. Paste a link starting with http:// or https://.`,
    )
  }

  let current = trimmed
  let response

  for (let hop = 0; ; hop += 1) {
    if (hop > MAX_REDIRECTS) {
      throw new FetchUrlError(`${trimmed} redirected too many times.`)
    }

    await assertPublicHost(current, lookup)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      response = await fetchImpl(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: { 'User-Agent': 'wissly/1.0 (+https://wissly.app)' },
        // Only the real fetch understands this, and only the real fetch
        // opens a socket that could be pointed somewhere else between the
        // check above and the connection — see `guardedLookup`.
        ...(fetchImpl === globalThis.fetch ? { dispatcher: guardedAgent } : {}),
      })
    } catch (cause) {
      throw new FetchUrlError(`Could not reach ${current}. Check the address and try again.`, { cause })
    } finally {
      clearTimeout(timeout)
    }

    if (response.status < 300 || response.status >= 400 || !response.headers?.get?.('location')) {
      break
    }

    const next = new URL(response.headers.get('location'), current).toString()
    if (!isHttpUrl(next)) {
      throw new FetchUrlError(`${current} redirected somewhere wissly will not follow.`)
    }
    current = next
  }

  if (!response.ok) {
    throw new FetchUrlError(`${current} answered with ${response.status}. Check the address and try again.`)
  }

  const contentType = response.headers?.get?.('content-type') ?? ''
  if (contentType && !contentType.includes('html')) {
    throw new FetchUrlError(`${current} is not a web page wissly can read (${contentType.split(';')[0]}).`)
  }

  const html = await readCapped(response, maxBytes, current)

  const { title, text } = readableTextFromHtml(html)

  if (text.trim() === '') {
    throw new FetchUrlError('There was no readable text on that page.')
  }

  return { title, text, url: current }
}
