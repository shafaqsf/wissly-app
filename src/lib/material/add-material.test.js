// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'

import { argsOf, fakeSupabase } from '@/lib/data/fake-supabase.js'
import { addMaterial } from './add-material.js'

/* Adding material ingests and files. It does not generate.
 *
 * This used to be the path that made up to twelve model calls on upload and
 * decided, without asking, that section 3 deserved a flashcard. The client
 * below is a tripwire: every method fails the test if anything reaches for
 * it, which is the one property this file exists to hold. */
function forbiddenClient() {
  return {
    chatStructured: vi.fn(() => {
      throw new Error('adding material must not call a model')
    }),
    chat: vi.fn(() => {
      throw new Error('adding material must not call a model')
    }),
  }
}

function supabaseFor({ sections, concepts }) {
  return fakeSupabase({
    subjects: { data: { id: 'sub-1', title: 'Optics' }, error: null },
    sources: { data: { id: 'src-1', title: 'Notes' }, error: null },
    sections: { data: sections, error: null },
    concepts: { data: concepts, error: null },
  })
}

const material = {
  subject: 'Optics',
  title: 'Notes',
  kind: 'text',
  text: 'Refraction\n\nLight bends at a boundary.\n\nSnell\n\nThe angle follows a law.',
}

const twoSections = {
  sections: [
    { id: 'sec-1', ordinal: 1, content: 'Light bends at a boundary.', anchor: {} },
    { id: 'sec-2', ordinal: 2, content: 'The angle follows a law.', anchor: {} },
  ],
  concepts: [
    { id: 'c1', section_id: 'sec-1' },
    { id: 'c2', section_id: 'sec-2' },
  ],
}

describe('adding material', () => {
  it('makes no model call', async () => {
    const supabase = supabaseFor(twoSections)
    const client = forbiddenClient()

    await addMaterial({ supabase, client, userId: 'user-1', material })

    expect(client.chatStructured).not.toHaveBeenCalled()
    expect(client.chat).not.toHaveBeenCalled()
  })

  it('writes nothing to artefacts — generating is a thing the learner asks for', async () => {
    const supabase = supabaseFor(twoSections)

    await addMaterial({ supabase, client: forbiddenClient(), userId: 'user-1', material })

    expect(supabase.queries('artefacts')).toEqual([])
  })

  it('works without a model client at all', async () => {
    const supabase = supabaseFor(twoSections)

    const result = await addMaterial({ supabase, userId: 'user-1', material })

    expect(result.source).toEqual({ id: 'src-1', title: 'Notes' })
    expect(result.sections).toHaveLength(2)
    expect(result.concepts).toHaveLength(2)
  })

  it("carries one learner's id from the subject through to the concepts", async () => {
    const supabase = supabaseFor(twoSections)

    await addMaterial({ supabase, client: forbiddenClient(), userId: 'user-1', material })

    for (const table of ['sources', 'sections', 'concepts']) {
      const [payload] = argsOf(supabase.query(table), 'insert')
      const rows = Array.isArray(payload) ? payload : [payload]
      expect(rows.every((row) => row.user_id === 'user-1'), table).toBe(true)
    }
  })

  it('stores every section there is, however many that comes to', async () => {
    const sections = Array.from({ length: 15 }, (_, index) => ({
      id: `sec-${index + 1}`,
      ordinal: index + 1,
      content: `Paragraph ${index + 1}.`,
      anchor: {},
    }))
    const supabase = supabaseFor({
      sections,
      concepts: sections.map((section, index) => ({
        id: `c${index + 1}`,
        section_id: section.id,
      })),
    })

    const result = await addMaterial({
      supabase,
      client: forbiddenClient(),
      userId: 'user-1',
      material: { ...material, text: sections.map((s) => s.content).join('\n\n') },
    })

    const [stored] = argsOf(supabase.query('sections'), 'insert')
    expect(stored).toHaveLength(15)
    expect(result.sections).toHaveLength(15)
  })

  it('refuses material with nothing readable in it', async () => {
    const supabase = fakeSupabase()

    await expect(
      addMaterial({
        supabase,
        client: forbiddenClient(),
        userId: 'user-1',
        material: { ...material, text: '   ' },
      }),
    ).rejects.toThrow(/no readable text/i)

    expect(supabase.calls).toHaveLength(0)
  })
})

describe('richer source kinds', () => {
  it('stores a web link with its address as the origin, not part of any anchor', async () => {
    const supabase = supabaseFor(twoSections)

    await addMaterial({
      supabase,
      client: forbiddenClient(),
      userId: 'user-1',
      material: {
        subject: 'Optics',
        title: 'An article',
        kind: 'url',
        text: 'Light bends.\n\nSnell.',
        origin: 'https://example.com/refraction',
      },
    })

    const [row] = argsOf(supabase.query('sources'), 'insert')
    expect(row.kind).toBe('url')
    expect(row.origin).toBe('https://example.com/refraction')
    expect(row.raw_text).toBe('Light bends.\n\nSnell.')
  })

  it('makes no model call for a web link — it is ingested exactly like pasted text', async () => {
    const supabase = supabaseFor(twoSections)

    await addMaterial({
      supabase,
      client: forbiddenClient(),
      userId: 'user-1',
      material: {
        subject: 'Optics',
        title: 'An article',
        kind: 'url',
        text: 'Light bends.\n\nSnell.',
        origin: 'https://example.com/refraction',
      },
    })
  })

  it('leaves a PDF alone unless explainImages says otherwise — the same tripwire as text', async () => {
    const supabase = supabaseFor(twoSections)

    await addMaterial({
      supabase,
      client: forbiddenClient(),
      userId: 'user-1',
      material: {
        subject: 'Optics',
        title: 'Diagram-heavy notes',
        kind: 'pdf',
        data: tinyPdf(['Fig. 1']),
      },
    })
  })

  it('explains a diagram on a PDF page once the learner asks for it', async () => {
    const supabase = supabaseFor(twoSections)
    const client = { chat: vi.fn(async () => ({ content: 'A diagram of a lens bending light.' })) }

    await addMaterial({
      supabase,
      client,
      userId: 'user-1',
      material: {
        subject: 'Optics',
        title: 'Diagram-heavy notes',
        kind: 'pdf',
        data: tinyPdf(['Fig. 1']),
        explainImages: true,
      },
    })

    expect(client.chat).toHaveBeenCalled()
    const [rows] = argsOf(supabase.query('sections'), 'insert')
    expect(rows.some((row) => row.content.includes('A diagram of a lens bending light.'))).toBe(
      true,
    )
  })

  it('transcribes a photo through the given client and ingests it like pasted text', async () => {
    const supabase = supabaseFor(twoSections)
    const client = { chat: vi.fn(async () => ({ content: 'Handwritten notes.\n\nSecond idea.' })) }

    await addMaterial({
      supabase,
      client,
      userId: 'user-1',
      material: {
        subject: 'Optics',
        title: 'A photo of my notes',
        kind: 'image',
        data: new Uint8Array([1, 2, 3]),
        mimeType: 'image/png',
      },
    })

    expect(client.chat).toHaveBeenCalledTimes(1)
    const [row] = argsOf(supabase.query('sources'), 'insert')
    expect(row.kind).toBe('image')
  })

  it('refuses a photo with no client to transcribe it', async () => {
    const supabase = supabaseFor(twoSections)

    await expect(
      addMaterial({
        supabase,
        userId: 'user-1',
        material: {
          subject: 'Optics',
          title: 'A photo',
          kind: 'image',
          data: new Uint8Array([1, 2, 3]),
        },
      }),
    ).rejects.toThrow(/vision/i)
  })

  it('stores a slide deck with its slide anchors, and makes no model call', async () => {
    const supabase = supabaseFor({
      sections: [
        { id: 'sec-1', ordinal: 1, content: 'Title slide', anchor: { slide: 1 } },
        { id: 'sec-2', ordinal: 2, content: 'Second slide', anchor: { slide: 2 } },
      ],
      concepts: twoSections.concepts,
    })

    await addMaterial({
      supabase,
      client: forbiddenClient(),
      userId: 'user-1',
      material: {
        subject: 'Optics',
        title: 'Slides',
        kind: 'pptx',
        data: await tinyPptx(['Title slide', 'Second slide']),
      },
    })

    const [row] = argsOf(supabase.query('sources'), 'insert')
    expect(row.kind).toBe('pptx')
  })
})

/** The same minimal, real PDF `ingest.test.js` builds, so this exercises the
 * real `unpdf` extraction rather than a stub — the point of the two tests
 * above that explain (or refuse to explain) a diagram. */
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

/** The same minimal, real .pptx `ingest.test.js` builds. */
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
