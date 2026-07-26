// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import {
  ingestSource,
  sectionsFromImage,
  sectionsFromPdf,
  sectionsFromPptx,
  sectionsFromText,
} from './ingest.js'

describe('sectionsFromText', () => {
  it('returns nothing for an empty or blank source', () => {
    expect(sectionsFromText('')).toEqual([])
    expect(sectionsFromText('   \n\n \t ')).toEqual([])
    expect(sectionsFromText(undefined)).toEqual([])
  })

  it('makes one section of a single paragraph', () => {
    expect(sectionsFromText('A monad is a monoid.')).toEqual([
      {
        ordinal: 1,
        content: 'A monad is a monoid.',
        anchor: { start: 0, end: 20 },
      },
    ])
  })

  it('splits on blank lines', () => {
    const sections = sectionsFromText('First idea.\n\nSecond idea.')
    expect(sections.map((section) => section.content)).toEqual([
      'First idea.',
      'Second idea.',
    ])
  })

  it('numbers sections from one, contiguously', () => {
    const sections = sectionsFromText('One.\n\nTwo.\n\n\n\nThree.')
    expect(sections.map((section) => section.ordinal)).toEqual([1, 2, 3])
  })

  it('anchors every section at its offsets in the original text', () => {
    const text = 'First idea.\n\nSecond idea.'
    const sections = sectionsFromText(text)
    for (const section of sections) {
      expect(text.slice(section.anchor.start, section.anchor.end)).toBe(
        section.content,
      )
    }
  })

  it('never emits a section without an anchor', () => {
    const sections = sectionsFromText('# Title\n\nBody.\n\nMore body.')
    for (const section of sections) {
      expect(Number.isInteger(section.anchor.start)).toBe(true)
      expect(section.anchor.end).toBeGreaterThan(section.anchor.start)
    }
  })

  it('starts a new section at a markdown heading and keeps the heading in the text', () => {
    const sections = sectionsFromText('Intro.\n# Monads\nA monad is a monoid.')
    expect(sections.map((section) => section.content)).toEqual([
      'Intro.',
      '# Monads\nA monad is a monoid.',
    ])
  })

  it('records the heading a section sits under', () => {
    const sections = sectionsFromText(
      '# Monads\n\nA monad is a monoid.\n\nIt also has a unit.\n\n## Laws\n\nLeft identity.',
    )
    expect(sections.map((section) => section.anchor.heading)).toEqual([
      'Monads',
      'Monads',
      'Monads',
      'Laws',
      'Laws',
    ])
  })

  it('leaves the heading out of the anchor when there is none', () => {
    const [section] = sectionsFromText('Just prose.')
    expect(section.anchor).not.toHaveProperty('heading')
  })

  it('keeps a heading with no body as its own section', () => {
    const sections = sectionsFromText('# Monads\n\n# Functors\n\nA functor maps.')
    expect(sections.map((section) => section.content)).toEqual([
      '# Monads',
      '# Functors',
      'A functor maps.',
    ])
  })

  it('keeps the lines of a list together as one section', () => {
    const sections = sectionsFromText('Rules:\n- one\n- two\n- three')
    expect(sections).toHaveLength(1)
    expect(sections[0].content).toBe('Rules:\n- one\n- two\n- three')
  })

  it('normalises Windows line endings before splitting', () => {
    const sections = sectionsFromText('One.\r\n\r\nTwo.')
    expect(sections.map((section) => section.content)).toEqual(['One.', 'Two.'])
  })

  it('drops trailing whitespace from a section without losing the anchor', () => {
    const text = '   Padded.   \n\nNext.'
    const [first] = sectionsFromText(text)
    expect(first.content).toBe('Padded.')
    expect(text.slice(first.anchor.start, first.anchor.end)).toBe('Padded.')
  })

  it('breaks a section that is too long for one generation call', () => {
    const long = `${'This is a sentence. '.repeat(400)}`
    const sections = sectionsFromText(long, { maxChars: 500 })
    expect(sections.length).toBeGreaterThan(10)
    for (const section of sections) {
      expect(section.content.length).toBeLessThanOrEqual(500)
    }
    expect(sections.map((section) => section.ordinal)).toEqual(
      sections.map((_, index) => index + 1),
    )
  })

  it('breaks a long section at a sentence boundary, not mid-word', () => {
    const long = `${'Alpha beta gamma delta. '.repeat(40)}`
    const sections = sectionsFromText(long, { maxChars: 120 })
    for (const section of sections) {
      expect(section.content.endsWith('.')).toBe(true)
    }
  })

  it('still splits text with no sentence boundary at all', () => {
    const sections = sectionsFromText('x'.repeat(1000), { maxChars: 100 })
    expect(sections).toHaveLength(10)
    expect(sections.every((section) => section.content.length === 100)).toBe(true)
  })
})

describe('sectionsFromPdf', () => {
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])

  const extractor = (pages) =>
    vi.fn(async () => ({ totalPages: pages.length, text: pages }))

  it('gives every section the page it came from', async () => {
    const extractText = extractor(['Page one text.', 'Page two text.'])
    const sections = await sectionsFromPdf(pdfBytes, { extractText })

    expect(sections).toEqual([
      { ordinal: 1, content: 'Page one text.', anchor: { page: 1 } },
      { ordinal: 2, content: 'Page two text.', anchor: { page: 2 } },
    ])
  })

  it('asks the extractor for text per page, not merged', async () => {
    const extractText = extractor(['a'])
    await sectionsFromPdf(pdfBytes, { extractText })
    expect(extractText).toHaveBeenCalledWith(pdfBytes, { mergePages: false })
  })

  it('skips a page with no text but keeps the page numbers of the rest honest', async () => {
    const extractText = extractor(['One.', '   ', '', 'Four.'])
    const sections = await sectionsFromPdf(pdfBytes, { extractText })

    expect(sections).toEqual([
      { ordinal: 1, content: 'One.', anchor: { page: 1 } },
      { ordinal: 2, content: 'Four.', anchor: { page: 4 } },
    ])
  })

  it('splits a long page further, and every piece keeps the page anchor', async () => {
    const extractText = extractor([`${'A sentence here. '.repeat(60)}`])
    const sections = await sectionsFromPdf(pdfBytes, { extractText, maxChars: 300 })

    expect(sections.length).toBeGreaterThan(2)
    for (const section of sections) {
      expect(section.anchor).toEqual({ page: 1 })
      expect(section.content.length).toBeLessThanOrEqual(300)
    }
    expect(sections.map((section) => section.ordinal)).toEqual(
      sections.map((_, index) => index + 1),
    )
  })

  it('collapses the ragged whitespace that text extraction leaves behind', async () => {
    const extractText = extractor(['A   line\n\n  and    another.  '])
    const [section] = await sectionsFromPdf(pdfBytes, { extractText })
    expect(section.content).toBe('A line and another.')
  })

  it('returns nothing for a PDF whose pages are all images', async () => {
    const extractText = extractor(['', '  '])
    await expect(sectionsFromPdf(pdfBytes, { extractText })).resolves.toEqual([])
  })
})

/**
 * Build a real, minimal PDF so that the default extractor is exercised for
 * once. Every other PDF test stubs extraction, which proves our own logic but
 * would keep passing if the library were removed entirely.
 */
function tinyPdf(lines) {
  const stream = lines
    .map((line, index) => `BT /F1 12 Tf 20 ${160 - index * 20} Td (${line}) Tj ET`)
    .join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const startxref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`
  return Uint8Array.from([...pdf].map((character) => character.charCodeAt(0)))
}

describe('sectionsFromPdf — against a real PDF', () => {
  it('extracts the text of a page and anchors it', async () => {
    const sections = await sectionsFromPdf(tinyPdf(['Hello wissly.', 'A second line.']))
    expect(sections).toEqual([
      {
        ordinal: 1,
        content: 'Hello wissly. A second line.',
        anchor: { page: 1 },
      },
    ])
  })
})

describe('sectionsFromPdf — explaining image-heavy pages', () => {
  const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])
  const extractor = (pages) => vi.fn(async () => ({ totalPages: pages.length, text: pages }))

  it('never calls the model when no vision client is given', async () => {
    const extractText = extractor(['Fig. 3'])
    const explainImage = vi.fn()

    await sectionsFromPdf(pdfBytes, { extractText, explainImage })

    expect(explainImage).not.toHaveBeenCalled()
  })

  it('leaves a page full of prose alone even when a vision client is available', async () => {
    const extractText = extractor([`${'A full page of ordinary prose. '.repeat(20)}`])
    const explainImage = vi.fn()

    await sectionsFromPdf(pdfBytes, { extractText, visionClient: {}, explainImage })

    expect(explainImage).not.toHaveBeenCalled()
  })

  it('asks the vision client to describe a sparse, image-heavy page', async () => {
    const extractText = extractor(['Fig. 3'])
    const visionClient = {}
    const explainImage = vi.fn(async () => 'A diagram of the water cycle.')

    const sections = await sectionsFromPdf(pdfBytes, { extractText, visionClient, explainImage })

    expect(explainImage).toHaveBeenCalledWith(
      expect.objectContaining({ visionClient, data: pdfBytes, page: 1 }),
    )
    expect(sections[0].content).toContain('A diagram of the water cycle.')
    expect(sections[0].content).toContain('Fig. 3')
    expect(sections[0].anchor).toEqual({ page: 1 })
  })

  it('explains a page that had no extractable text at all', async () => {
    const extractText = extractor([''])
    const explainImage = vi.fn(async () => 'A diagram of a cell.')

    const sections = await sectionsFromPdf(pdfBytes, { extractText, visionClient: {}, explainImage })

    expect(sections).toEqual([{ ordinal: 1, content: 'A diagram of a cell.', anchor: { page: 1 } }])
  })

  it('still anchors every piece at its page when the explanation pushes a page over the limit', async () => {
    const extractText = extractor(['Fig. 9'])
    const explainImage = vi.fn(async () => 'A long diagram description. '.repeat(30))

    const sections = await sectionsFromPdf(pdfBytes, {
      extractText,
      visionClient: {},
      explainImage,
      maxChars: 200,
    })

    expect(sections.length).toBeGreaterThan(1)
    for (const section of sections) expect(section.anchor).toEqual({ page: 1 })
  })
})

describe('sectionsFromPptx', () => {
  const pptxBytes = new Uint8Array([1])
  const extractor = (slides) => vi.fn(async () => slides)

  it('gives every section the slide it came from', async () => {
    const extractSlides = extractor([
      { slide: 1, text: 'Title slide' },
      { slide: 2, text: 'Second slide' },
    ])

    const sections = await sectionsFromPptx(pptxBytes, { extractSlides })

    expect(sections).toEqual([
      { ordinal: 1, content: 'Title slide', anchor: { slide: 1 } },
      { ordinal: 2, content: 'Second slide', anchor: { slide: 2 } },
    ])
  })

  it('skips a slide with no text but keeps the slide numbers of the rest honest', async () => {
    const extractSlides = extractor([
      { slide: 1, text: 'One.' },
      { slide: 2, text: '   ' },
      { slide: 3, text: 'Three.' },
    ])

    const sections = await sectionsFromPptx(pptxBytes, { extractSlides })

    expect(sections).toEqual([
      { ordinal: 1, content: 'One.', anchor: { slide: 1 } },
      { ordinal: 2, content: 'Three.', anchor: { slide: 3 } },
    ])
  })

  it('splits a long slide further, and every piece keeps the slide anchor', async () => {
    const extractSlides = extractor([{ slide: 1, text: `${'A sentence here. '.repeat(60)}` }])

    const sections = await sectionsFromPptx(pptxBytes, { extractSlides, maxChars: 300 })

    expect(sections.length).toBeGreaterThan(2)
    for (const section of sections) {
      expect(section.anchor).toEqual({ slide: 1 })
      expect(section.content.length).toBeLessThanOrEqual(300)
    }
  })

  it('returns nothing for a deck whose slides are all images', async () => {
    const extractSlides = extractor([
      { slide: 1, text: '' },
      { slide: 2, text: '   ' },
    ])

    await expect(sectionsFromPptx(pptxBytes, { extractSlides })).resolves.toEqual([])
  })
})

/**
 * Build a real, minimal .pptx so the default extractor is exercised for once —
 * the same reason `tinyPdf` exists above. A .pptx is a zip of XML parts; the
 * text of a slide lives in `<a:t>` runs inside `ppt/slides/slideN.xml`.
 */
async function tinyPptx(slideTexts) {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  slideTexts.forEach((text, index) => {
    zip.file(
      `ppt/slides/slide${index + 1}.xml`,
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody>
    <a:p><a:r><a:t>${text}</a:t></a:r></a:p>
  </p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
    )
  })

  return zip.generateAsync({ type: 'uint8array' })
}

describe('sectionsFromPptx — against a real .pptx', () => {
  it('extracts the text of a slide and anchors it', async () => {
    const pptx = await tinyPptx(['Hello wissly.', 'A second slide.'])

    const sections = await sectionsFromPptx(pptx)

    expect(sections).toEqual([
      { ordinal: 1, content: 'Hello wissly.', anchor: { slide: 1 } },
      { ordinal: 2, content: 'A second slide.', anchor: { slide: 2 } },
    ])
  })

  it('decodes the XML entities a real deck writes for &, < and >', async () => {
    const pptx = await tinyPptx(['Salt &amp; pepper: a &lt;pinch&gt; of each.'])

    const [section] = await sectionsFromPptx(pptx)

    expect(section.content).toBe('Salt & pepper: a <pinch> of each.')
  })
})

describe('sectionsFromImage', () => {
  const photoBytes = new Uint8Array([1, 2, 3])

  it('transcribes the photo and cuts it up exactly as pasted text would be', async () => {
    const visionClient = {
      chat: vi.fn(async () => ({ content: 'Handwritten notes.\n\nSecond paragraph.' })),
    }

    const sections = await sectionsFromImage(photoBytes, { visionClient })

    expect(sections).toEqual(sectionsFromText('Handwritten notes.\n\nSecond paragraph.'))
  })

  it('sends the photo to the model as a base64 image', async () => {
    const visionClient = { chat: vi.fn(async () => ({ content: 'Text.' })) }

    await sectionsFromImage(photoBytes, { visionClient, mimeType: 'image/png' })

    const [{ messages }] = visionClient.chat.mock.calls[0]
    const imagePart = messages[0].content.find((part) => part.type === 'image_url')
    expect(imagePart.image_url.url).toMatch(/^data:image\/png;base64,/)
  })

  it('refuses to transcribe a photo without a vision-capable client', async () => {
    await expect(sectionsFromImage(photoBytes, {})).rejects.toThrow(/vision/i)
  })

  it('returns nothing when the model finds no writing on the photo', async () => {
    const visionClient = { chat: vi.fn(async () => ({ content: '   ' })) }

    await expect(sectionsFromImage(photoBytes, { visionClient })).resolves.toEqual([])
  })
})

describe('ingestSource', () => {
  it('dispatches pasted text', async () => {
    await expect(ingestSource({ kind: 'text', text: 'One.\n\nTwo.' })).resolves.toEqual(
      sectionsFromText('One.\n\nTwo.'),
    )
  })

  it('dispatches a PDF', async () => {
    const extractText = vi.fn(async () => ({ totalPages: 1, text: ['Page.'] }))
    await expect(
      ingestSource({ kind: 'pdf', data: new Uint8Array([1]), extractText }),
    ).resolves.toEqual([{ ordinal: 1, content: 'Page.', anchor: { page: 1 } }])
  })

  it('dispatches a PPTX', async () => {
    const extractSlides = vi.fn(async () => [{ slide: 1, text: 'Slide one.' }])
    await expect(
      ingestSource({ kind: 'pptx', data: new Uint8Array([1]), extractSlides }),
    ).resolves.toEqual([{ ordinal: 1, content: 'Slide one.', anchor: { slide: 1 } }])
  })

  it('dispatches a web link exactly like pasted text', async () => {
    await expect(ingestSource({ kind: 'url', text: 'One.\n\nTwo.' })).resolves.toEqual(
      sectionsFromText('One.\n\nTwo.'),
    )
  })

  it('dispatches a photo, transcribing it through the given client', async () => {
    const client = { chat: vi.fn(async () => ({ content: 'Notes.' })) }
    await expect(
      ingestSource({ kind: 'image', data: new Uint8Array([1]), client }),
    ).resolves.toEqual(sectionsFromText('Notes.'))
  })

  it('never explains a PDF diagram unless the caller opts in', async () => {
    const extractText = vi.fn(async () => ({ totalPages: 1, text: ['Fig 1'] }))
    const explainImage = vi.fn()
    const client = { chat: vi.fn() }

    await ingestSource({ kind: 'pdf', data: new Uint8Array([1]), extractText, client, explainImage })

    expect(explainImage).not.toHaveBeenCalled()
  })

  it('explains PDF diagrams once the caller asks for it', async () => {
    const extractText = vi.fn(async () => ({ totalPages: 1, text: ['Fig 1'] }))
    const explainImage = vi.fn(async () => 'A diagram.')
    const client = {}

    const sections = await ingestSource({
      kind: 'pdf',
      data: new Uint8Array([1]),
      extractText,
      client,
      explainImage,
      explainImages: true,
    })

    expect(explainImage).toHaveBeenCalled()
    expect(sections[0].content).toContain('A diagram.')
  })

  it('refuses a kind it does not handle yet', async () => {
    await expect(ingestSource({ kind: 'youtube' })).rejects.toThrow(
      /unsupported source kind "youtube"/,
    )
  })
})
