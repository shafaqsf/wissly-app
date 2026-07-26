import 'server-only'

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
 * Fetch a URL and reduce it to readable text, ready for `ingestSource({kind:
 * 'url', text })`.
 *
 * @param {string} url
 * @param {{fetch?: typeof fetch, maxBytes?: number, timeoutMs?: number}} [options]
 * @returns {Promise<{title: string, text: string, url: string}>}
 */
export async function fetchReadableText(
  url,
  { fetch: fetchImpl = globalThis.fetch, maxBytes = MAX_BYTES, timeoutMs = FETCH_TIMEOUT_MS } = {},
) {
  const trimmed = String(url ?? '').trim()
  if (!isHttpUrl(trimmed)) {
    throw new FetchUrlError(
      `"${trimmed}" is not a web address. Paste a link starting with http:// or https://.`,
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  let response
  try {
    response = await fetchImpl(trimmed, {
      signal: controller.signal,
      headers: { 'User-Agent': 'wissly/1.0 (+https://wissly.app)' },
    })
  } catch (cause) {
    throw new FetchUrlError(`Could not reach ${trimmed}. Check the address and try again.`, { cause })
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    throw new FetchUrlError(`${trimmed} answered with ${response.status}. Check the address and try again.`)
  }

  const contentType = response.headers?.get?.('content-type') ?? ''
  if (contentType && !contentType.includes('html')) {
    throw new FetchUrlError(`${trimmed} is not a web page wissly can read (${contentType.split(';')[0]}).`)
  }

  const html = await response.text()
  if (html.length > maxBytes) {
    throw new FetchUrlError(`${trimmed} is too large a page to import.`)
  }

  const { title, text } = readableTextFromHtml(html)

  if (text.trim() === '') {
    throw new FetchUrlError('There was no readable text on that page.')
  }

  return { title, text, url: trimmed }
}
