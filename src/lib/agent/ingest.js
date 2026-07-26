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
 * - PDF — `{ page }`, one-based, exactly as a reader counts pages. A page
 *   that is mostly a diagram rather than prose can carry a model's
 *   description of it too, folded into the same section — see
 *   `sectionsFromPdf` — so the anchor is still just the page it came from.
 * - PPTX — `{ slide }`, one-based, matching the deck's own numbering.
 * - Web link — ingested exactly like pasted text once the page is reduced to
 *   its readable prose (`src/lib/material/fetch-url.js`), so the anchor is
 *   the same `{ start, end }` into that text. The address itself is not part
 *   of the anchor; it lives on the source as `origin`.
 * - Photo of handwriting or print — transcribed by a vision model, then
 *   ingested exactly like pasted text; anchored the same way, into the
 *   transcription, because once the section exists the photo is gone and an
 *   offset into words on the screen is the only anchor left to give.
 *
 * Stage 2 still owes transcripts (`{ start_ms, end_ms }`).
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
 * Below this many characters of extracted text, a page reads as a diagram or
 * a photograph with a caption rather than as prose — the heuristic point 2 of
 * the brief allows: "a low extracted-text-to-page-area ratio". We do not have
 * the page's rendered area from a text-only extractor, so the ratio is
 * approximated by an absolute floor instead. It is deliberately generous —
 * false positives cost one extra model call, false negatives leave a diagram
 * silently unexplained, and the first is the cheaper mistake.
 */
const IMAGE_HEAVY_CHARS = 120

/** Asked once per candidate page; short, because the answer is folded into a section a learner reads as prose, not as a caption. */
function explainPagePrompt(page) {
  return (
    `Describe, in two or three plain sentences a learner could read as notes, ` +
    `any diagram, chart, photograph or illustration on page ${page} of the ` +
    `attached PDF. If the page is only text, reply with nothing.`
  )
}

/**
 * The default explainer: the whole PDF, handed to a vision-capable OpenRouter
 * model as a `file` content part — the same trick used for chat attachments —
 * with a question about one specific page. Sending the file once per
 * candidate page is simpler than rendering that page to an image ourselves,
 * and it reuses `chat` exactly as every other model call in this codebase
 * does, rather than adding a PDF-rasterising dependency for one heuristic.
 */
async function defaultExplainImage({ visionClient, data, page }) {
  const base64 = Buffer.from(data).toString('base64')
  const { content } = await visionClient.chat({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: explainPagePrompt(page) },
          {
            type: 'file',
            file: { filename: 'source.pdf', file_data: `data:application/pdf;base64,${base64}` },
          },
        ],
      },
    ],
    plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }],
  })
  return content
}

/**
 * Split a PDF into sections, one per page, each anchored at its page number.
 *
 * When `visionClient` is given, a sparse page also gets a model's textual
 * explanation of whatever it is carrying instead of prose, folded into the
 * same section so it can still be summarised and quizzed like any other
 * paragraph. Without a `visionClient` this makes no model call at all — the
 * same "nothing generated on ingest" guarantee `addMaterial` holds for text
 * and pdf applies here unless the caller explicitly opts in.
 *
 * @param {Uint8Array|ArrayBuffer} data
 * @param {{extractText?: Function, maxChars?: number, visionClient?: object,
 *   explainImage?: Function, imageHeavyChars?: number}} [options]
 * @returns {Promise<Array<{ordinal: number, content: string,
 *   anchor: {page: number}}>>}
 */
export async function sectionsFromPdf(
  data,
  {
    extractText = defaultExtractText,
    maxChars = DEFAULT_MAX_CHARS,
    visionClient,
    explainImage = defaultExplainImage,
    imageHeavyChars = IMAGE_HEAVY_CHARS,
  } = {},
) {
  const { text } = await extractText(data, { mergePages: false })
  const pages = Array.isArray(text) ? text : [text]

  const sections = []
  for (const [index, pageText] of pages.entries()) {
    const page = index + 1
    let content = tidy(pageText)

    if (visionClient && content.length < imageHeavyChars) {
      const explanation = tidy(await explainImage({ visionClient, data, page }))
      content = [content, explanation].filter(Boolean).join(' ')
    }

    if (content === '') continue // still nothing to anchor, image or no vision client
    for (const piece of splitLongText(content, maxChars)) {
      sections.push({ ordinal: sections.length + 1, content: piece, anchor: { page } })
    }
  }

  return sections
}

/** `ppt/slides/slide7.xml` -> `7`. */
function slideNumberOf(path) {
  return Number(path.match(/slide(\d+)\.xml$/)[1])
}

const XML_ENTITY = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }

function decodeXmlEntities(text) {
  return text.replace(/&(lt|gt|quot|apos|amp);/g, (_match, name) => XML_ENTITY[name])
}

/** Every text run a slide's XML carries, in document order, space-joined. */
function textRunsFrom(xml) {
  return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)]
    .map((match) => decodeXmlEntities(match[1]))
    .join(' ')
}

/**
 * The default slide reader: a `.pptx` is a zip of XML parts, and a slide's
 * text lives in `<a:t>` runs inside `ppt/slides/slideN.xml`. `jszip` unpacks
 * the archive; the XML itself is read with a small regex rather than a full
 * parser, because the only structure this needs out of it is "every run of
 * text, in order" — a real DOM would cost a second dependency to answer the
 * same question.
 */
async function defaultExtractSlides(data) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(data)

  const names = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => slideNumberOf(a) - slideNumberOf(b))

  const slides = []
  for (const name of names) {
    const xml = await zip.files[name].async('string')
    slides.push({ slide: slideNumberOf(name), text: textRunsFrom(xml) })
  }
  return slides
}

/**
 * Split a slide deck into sections, one per slide, each anchored at its slide
 * number — the deck's own, one-based numbering, exactly as PDF sections
 * anchor at a page number.
 *
 * @param {Uint8Array|ArrayBuffer} data
 * @param {{extractSlides?: Function, maxChars?: number}} [options]
 * @returns {Promise<Array<{ordinal: number, content: string,
 *   anchor: {slide: number}}>>}
 */
export async function sectionsFromPptx(
  data,
  { extractSlides = defaultExtractSlides, maxChars = DEFAULT_MAX_CHARS } = {},
) {
  const slides = await extractSlides(data)

  const sections = []
  for (const { slide, text } of slides) {
    const content = tidy(text)
    if (content === '') continue // a slide that is only an image anchors nothing, same as a pdf page
    for (const piece of splitLongText(content, maxChars)) {
      sections.push({ ordinal: sections.length + 1, content: piece, anchor: { slide } })
    }
  }
  return sections
}

const TRANSCRIBE_PROMPT =
  'Transcribe every word of writing in this photo exactly as written, in reading order. ' +
  'Reply with the transcription alone — no commentary, no markdown fences, no preamble.'

async function defaultTranscribeImage({ visionClient, data, mimeType }) {
  const base64 = Buffer.from(data).toString('base64')
  const { content } = await visionClient.chat({
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: TRANSCRIBE_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
  })
  return content
}

/**
 * Transcribe a photo of handwritten or printed notes, then cut the
 * transcription into sections exactly as `sectionsFromText` would. Unlike the
 * PDF diagram explanation above, a `visionClient` is not optional here: a
 * photo has no text to fall back to, so this is the one ingestion path that
 * always makes a model call — the OCR step other kinds get from `unpdf` or
 * from the browser's own paste, this kind can only get from the model.
 *
 * @param {Uint8Array|ArrayBuffer} data
 * @param {{visionClient: object, mimeType?: string,
 *   transcribeImage?: Function, maxChars?: number}} options
 * @returns {Promise<Array<object>>}
 */
export async function sectionsFromImage(
  data,
  { visionClient, mimeType = 'image/jpeg', transcribeImage = defaultTranscribeImage, maxChars } = {},
) {
  if (!visionClient) {
    throw new Error('A photo needs a vision-capable model to transcribe it — no client was given.')
  }
  const text = await transcribeImage({ visionClient, data, mimeType })
  return sectionsFromText(text, { maxChars })
}

/**
 * Ingest one source. Stage 1 handled pasted text and PDF; this adds slide
 * decks, web links and photos. A web link is ingested exactly like pasted
 * text — `text` is expected to already be the page's readable prose, reduced
 * by `src/lib/material/fetch-url.js` before this is ever called — so `url`
 * and `text` share one branch.
 *
 * `explainImages` gates the one model call this function can make on a PDF:
 * without it, a PDF is ingested exactly as it always was, no matter what
 * `client` is handed over. A photo has no such gate, because there is no
 * text underneath it to ingest instead.
 *
 * @param {{kind: 'text'|'pdf'|'pptx'|'url'|'image', text?: string,
 *   data?: Uint8Array, client?: object, explainImages?: boolean}} source
 * @returns {Promise<Array<object>>} sections, ready for the `sections` table
 */
export async function ingestSource({ kind, text, data, client, explainImages, ...options }) {
  if (kind === 'text' || kind === 'url') return sectionsFromText(text, options)
  if (kind === 'pdf') {
    return sectionsFromPdf(data, { ...options, visionClient: explainImages ? client : undefined })
  }
  if (kind === 'pptx') return sectionsFromPptx(data, options)
  if (kind === 'image') return sectionsFromImage(data, { ...options, visionClient: client })
  throw new TypeError(
    `unsupported source kind "${kind}" — wissly ingests text, pdf, pptx, url and image`,
  )
}
