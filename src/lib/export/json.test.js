import { describe, expect, it } from 'vitest'

import { bundleToJson, jsonFileName } from './json.js'

const bundle = {
  exported_at: '2026-07-26T00:00:00.000Z',
  courses: [{ subject: { id: 's1', title: 'Optics' }, sources: [], concepts: [], artefacts: [], reviews: [] }],
}

describe('bundleToJson', () => {
  it('serialises the whole bundle, losslessly', () => {
    const text = bundleToJson(bundle);

    expect(JSON.parse(text)).toEqual(bundle);
  });

  it('is readable, not minified — this is a file a learner keeps', () => {
    const text = bundleToJson(bundle);

    expect(text).toContain('\n');
  });
});

describe('jsonFileName', () => {
  it('names the file after the one course it holds', () => {
    expect(jsonFileName(bundle)).toBe('optics.json');
  });

  it('names a multi-course export generically', () => {
    expect(
      jsonFileName({ ...bundle, courses: [...bundle.courses, { subject: { title: 'Thermo' } }] }),
    ).toBe('wissly-export.json');
  });
});
