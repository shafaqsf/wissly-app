import 'server-only'

/**
 * Ingestion — a source becomes an ordered list of sections.
 *
 * A section is the unit everything downstream hangs off: artefacts are
 * generated per section, and every generated claim cites the section it came
 * from. That citation is only possible if the section carries an **anchor**
 * back into the original material, so no code path here may produce a section
 * without one.
 *
 * The shapes match the `sections` table (`id`, `source_id`, `ordinal`,
 * `content`, `anchor` jsonb). This module fills in `ordinal`, `content` and
 * `anchor`; the two ids belong to whoever writes the row.
 *
 * Anchors, per source kind:
 *
 * - pasted text — `{ start, end }`, character offsets into the text as it was
 *   pasted, plus `heading` when the section sits under one. Offsets survive
 *   re-rendering; a paragraph index would not.
 * - PDF — `{ page }`, one-based, exactly as a reader counts pages.
 *
 * Stage 2 adds slides (`{ slide }`) and transcripts (`{ start_ms, end_ms }`).
 */

/** Beyond this a section is too much context for one generation call. */
const DEFAULT_MAX_CHARS = 4000

const HEADING = /^(#{1,6})\s+(.*)$/

/**
 * Cut a block that is too long into pieces, preferring a sentence boundary and
 * falling back to a hard cut. A source with no full stops in it — a table, a
 * formula dump — must still be ingestable.
 *
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
function splitLongText(text, maxChars) {
  if (text.length <= maxChars) return [text]

  const pieces = []
  let rest = text

  while (rest.length > maxChars) {
    const window = rest.slice(0, maxChars)
    const boundary = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('.\n'),
      window.lastIndexOf('? '),
      window.lastIndexOf('! '),
    )
    const cut = boundary > maxChars * 0.3 ? boundary + 1 : maxChars
    pieces.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trimStart()
  }
  if (rest.length > 0) pieces.push(rest.trim())

  return pieces.filter(Boolean)
}

/**
 * Split pasted text into sections on its semantic boundaries: a blank line, or
 * a markdown heading — the two places where a writer has already told us the
 * subject changed.
 *
 * @param {string} text
 * @param {{maxChars?: number}} [options]
 * @returns {Array<{ordinal: number, content: string,
 *   anchor: {start: number, end: number, heading?: string}}>}
 */
export function sectionsFromText(text, { maxChars = DEFAULT_MAX_CHARS } = {}) {
  if (typeof text !== 'string' || text.trim() === '') return []

  // Offsets must index the string the caller holds, so normalise line endings
  // without changing the length: \r\n becomes \n\n would shift everything.
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  /** @type {Array<{start: number, end: number, heading?: string}>} */
  const blocks = []
  let heading
  let cursor = 0

  const push = (start, end) => {
    const raw = source.slice(start, end)
    const leading = raw.length - raw.trimStart().length
    const trailing = raw.length - raw.trimEnd().length
    if (raw.trim() === '') return
    blocks.push({ start: start + leading, end: end - trailing, heading })
  }

  const lines = source.split('\n')
  let blockStart = 0
  let offset = 0

  for (const line of lines) {
    const lineStart = offset
    const lineEnd = offset + line.length
    offset = lineEnd + 1 // the '\n' we split on

    const match = line.match(HEADING)
    if (match) {
      push(blockStart, lineStart)
      heading = match[2].trim()
      blockStart = lineStart
      continue
    }
    if (line.trim() === '') {
      push(blockStart, lineStart)
      blockStart = lineEnd + 1
    }
  }
  push(blockStart, source.length)
  cursor = 0

  /** @type {Array<{ordinal: number, content: string, anchor: object}>} */
  const sections = []
  for (const block of blocks) {
    const content = source.slice(block.start, block.end)
    for (const piece of splitLongText(content, maxChars)) {
      // Locate the piece inside the block so that even a split section keeps
      // an anchor that resolves back to the exact characters it quotes.
      const at = source.indexOf(piece, Math.max(block.start, cursor))
      const start = at === -1 ? block.start : at
      cursor = start + piece.length
      sections.push({
        ordinal: sections.length + 1,
        content: piece,
        anchor: {
          start,
          end: start + piece.length,
          ...(block.heading ? { heading: block.heading } : {}),
        },
      })
    }
  }

  return sections
}

/** Text extraction leaves ragged runs of spaces and newlines behind. */
function tidy(pageText) {
  return (pageText ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * The default extractor: unpdf, loaded lazily so that a route which only ever
 * ingests pasted text never pays for the PDF machinery.
 */
async function defaultExtractText(data, options) {
  const { extractText } = await import('unpdf')
  return extractText(data, options)
}

/**
 * Split a PDF into sections, one per page, each anchored at its page number.
 *
 * @param {Uint8Array|ArrayBuffer} data
 * @param {{extractText?: Function, maxChars?: number}} [options]
 * @returns {Promise<Array<{ordinal: number, content: string,
 *   anchor: {page: number}}>>}
 */
export async function sectionsFromPdf(
  data,
  { extractText = defaultExtractText, maxChars = DEFAULT_MAX_CHARS } = {},
) {
  const { text } = await extractText(data, { mergePages: false })
  const pages = Array.isArray(text) ? text : [text]

  const sections = []
  pages.forEach((pageText, index) => {
    const content = tidy(pageText)
    if (content === '') return // an image-only page anchors nothing
    for (const piece of splitLongText(content, maxChars)) {
      sections.push({
        ordinal: sections.length + 1,
        content: piece,
        anchor: { page: index + 1 },
      })
    }
  })

  return sections
}

/**
 * Ingest one source. Stage 1 handles pasted text and PDF; the remaining kinds
 * in the feature set are deliberately a loud failure rather than a silent one.
 *
 * @param {{kind: 'text'|'pdf', text?: string, data?: Uint8Array}} source
 * @returns {Promise<Array<object>>} sections, ready for the `sections` table
 */
export async function ingestSource({ kind, text, data, ...options }) {
  if (kind === 'text') return sectionsFromText(text, options)
  if (kind === 'pdf') return sectionsFromPdf(data, options)
  throw new TypeError(
    `unsupported source kind "${kind}" — stage 1 ingests text and pdf`,
  )
}
