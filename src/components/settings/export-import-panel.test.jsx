import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ExportImportPanel from './export-import-panel';

const bundle = {
  exported_at: '2026-07-26T00:00:00.000Z',
  courses: [{ subject: { id: 's1', title: 'Optics' }, sources: [], concepts: [], artefacts: [], reviews: [] }],
};

let click;

beforeEach(() => {
  // `vi.spyOn` re-wraps whatever is already there rather than resetting its
  // call history, so without this, `.mock.calls[0]` from an earlier test in
  // this file would still be sitting there for the next one to misread.
  vi.clearAllMocks();
  click = vi.fn();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
});

describe('ExportImportPanel', () => {
  it('offers all three export formats', () => {
    render(<ExportImportPanel exportAction={vi.fn()} importAction={vi.fn()} />);

    expect(screen.getByRole('button', { name: /export everything as json/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export as markdown/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export cards for anki/i })).toBeInTheDocument();
  });

  it('downloads a JSON file when that export is chosen', async () => {
    const user = userEvent.setup();
    const exportAction = vi.fn(async () => ({ bundle }));

    render(<ExportImportPanel exportAction={exportAction} importAction={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /export everything as json/i }));

    expect(exportAction).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('application/json');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('downloads a Markdown file when that export is chosen', async () => {
    const user = userEvent.setup();
    const exportAction = vi.fn(async () => ({ bundle }));

    render(<ExportImportPanel exportAction={exportAction} importAction={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /export as markdown/i }));

    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('text/markdown');
  });

  it('downloads the Anki text file when that export is chosen', async () => {
    const user = userEvent.setup();
    const exportAction = vi.fn(async () => ({ bundle }));

    render(<ExportImportPanel exportAction={exportAction} importAction={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /export cards for anki/i }));

    expect(URL.createObjectURL.mock.calls[0][0].type).toBe('text/plain');
  });

  it('reports an export the server refused', async () => {
    const user = userEvent.setup();
    const exportAction = vi.fn(async () => ({ error: 'That did not work.' }));

    render(<ExportImportPanel exportAction={exportAction} importAction={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /export everything as json/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That did not work.');
  });

  it('imports a chosen JSON file and reports what landed', async () => {
    const user = userEvent.setup();
    const importAction = vi.fn(async ({ bundle: sent }) => {
      expect(sent).toEqual(bundle);
      return { summary: { courses: 1, sources: 0, sections: 0, concepts: 0, artefacts: 2, reviews: 3 } };
    });

    render(<ExportImportPanel exportAction={vi.fn()} importAction={importAction} />);

    const file = new File([JSON.stringify(bundle)], 'optics.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(/import a wissly export/i), file);

    expect(await screen.findByRole('status')).toHaveTextContent(/1 course/i);
    expect(importAction).toHaveBeenCalled();
  });

  it('reports a file that is not readable JSON', async () => {
    // `accept` on the input is a hint, not a hard block — a real file dialog
    // can still hand back something else, and that is exactly the path this
    // test means to exercise, so user-event's own accept-filtering is turned
    // off here rather than worked around with a JSON-typed file. This option
    // is read from setup(), not from an upload() call — see
    // node_modules/@testing-library/user-event's upload.js.
    const user = userEvent.setup({ applyAccept: false });
    const importAction = vi.fn();

    render(<ExportImportPanel exportAction={vi.fn()} importAction={importAction} />);

    const file = new File(['not json'], 'notes.txt', { type: 'text/plain' });
    await user.upload(screen.getByLabelText(/import a wissly export/i), file);

    expect(await screen.findByRole('alert')).toHaveTextContent(/not readable/i);
    expect(importAction).not.toHaveBeenCalled();
  });
});
