import { describe, expect, it } from 'vitest'

import { bundleToAnkiText } from './anki.js'

const bundle = {
  exported_at: '2026-07-26T00:00:00.000Z',
  courses: [
    {
      subject: { id: 's1', title: 'Optics' },
      sources: [],
      concepts: [],
      artefacts: [
        {
          id: 'a1',
          format: 'flashcard',
          payload: { front: 'What bends light?', back: 'A change of medium.' },
        },
        {
          id: 'a2',
          format: 'cloze',
          payload: { text: 'Light ____ at a boundary.', answer: 'bends' },
        },
        // Reading formats are not recall — Anki review only makes sense for
        // the four task formats, so these two must not appear as rows.
        { id: 'a3', format: 'summary', payload: { three_sentences: ['a', 'b', 'c'], paragraph: 'p', full: 'f' } },
        { id: 'a4', format: 'glossary', payload: { term: 'x', definition: 'y' } },
      ],
      reviews: [],
    },
  ],
}

describe('bundleToAnkiText', () => {
  it('opens with the header Anki expects for a tab-separated plain text import', () => {
    const text = bundleToAnkiText(bundle);
    const [header] = text.split('\n');

    expect(header).toBe('#separator:tab');
  });

  it('writes one Front-Back row per flashcard', () => {
    const text = bundleToAnkiText(bundle);

    expect(text).toContain('What bends light?\tA change of medium.');
  });

  it('turns a cloze’s blank into the answer for the Back field', () => {
    const text = bundleToAnkiText(bundle);

    expect(text).toContain('Light ____ at a boundary.\tbends');
  });

  it('carries reading formats along as nothing, not as blank rows', () => {
    const text = bundleToAnkiText(bundle);
    const rows = text.split('\n').filter((line) => !line.startsWith('#') && line.trim() !== '');

    expect(rows).toHaveLength(2);
  });

  it('escapes a literal tab or newline inside a field, so the row stays two columns', () => {
    const withNewline = {
      ...bundle,
      courses: [
        {
          ...bundle.courses[0],
          artefacts: [
            { id: 'a5', format: 'flashcard', payload: { front: 'Line one\nLine two', back: 'One\tTwo' } },
          ],
        },
      ],
    };

    const text = bundleToAnkiText(withNewline);
    const row = text.split('\n').find((line) => line.includes('Line one'));

    expect(row.split('\t')).toHaveLength(2);
    expect(row).toContain('<br>');
  });

  it('says plainly when there is nothing to review', () => {
    const text = bundleToAnkiText({
      exported_at: '2026-07-26T00:00:00.000Z',
      courses: [{ subject: { id: 's2', title: 'Empty' }, sources: [], concepts: [], artefacts: [], reviews: [] }],
    });

    const rows = text.split('\n').filter((line) => !line.startsWith('#') && line.trim() !== '');
    expect(rows).toHaveLength(0);
  });
});
