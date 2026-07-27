'use client';

import { useState } from 'react';

import { quietButtonClass } from '@/components/artefact/control';
import { ankiFileName, bundleToAnkiText } from '@/lib/export/anki.js';
import { bundleToJson, jsonFileName } from '@/lib/export/json.js';
import { bundleToMarkdown, markdownFileName } from '@/lib/export/markdown.js';

/* Carrying data out of the account, and back in.
 *
 * Export gathers the whole bundle server-side (`exportAction`, backed by
 * `src/lib/data/export.js` — review history alone is not something any page
 * already has loaded) and turns it into a file entirely in the browser, the
 * same way `ExportReading` on the course page does: no request for the file
 * itself, just a `Blob` and a click.
 *
 * Three formats, three different jobs. JSON is the one that round-trips —
 * it is what `importAction` reads back — and is the only one worth keeping
 * if the plan is ever to bring the data back into wissly. Markdown is for
 * reading, Anki's plain text is for a different spaced-repetition app
 * entirely; see `src/lib/export/anki.js` for why that one is Front/Back text
 * rather than a `.apkg` binary. */

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

function summaryMessage(summary) {
  const { courses, sources, artefacts, reviews } = summary;
  return [
    `Imported ${courses} course${courses === 1 ? '' : 's'}`,
    `${sources} source${sources === 1 ? '' : 's'}`,
    `${artefacts} card${artefacts === 1 ? '' : 's'}`,
    `${reviews} review${reviews === 1 ? '' : 's'}`,
  ].join(', ') + '.';
}

export default function ExportImportPanel({ exportAction, importAction }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  async function exportAs(format) {
    setError(null);
    setMessage(null);
    setPending(true);

    const result = await exportAction({});

    setPending(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    const { bundle } = result;

    if (format === 'json') download(jsonFileName(bundle), bundleToJson(bundle), 'application/json');
    if (format === 'markdown') {
      download(markdownFileName(bundle), bundleToMarkdown(bundle), 'text/markdown');
    }
    if (format === 'anki') download(ankiFileName(bundle), bundleToAnkiText(bundle), 'text/plain');
  }

  async function onImportFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setMessage(null);
    setPending(true);

    let bundle;
    try {
      bundle = JSON.parse(await file.text());
    } catch {
      setPending(false);
      setError('That file is not readable JSON. Choose a wissly export.');
      return;
    }

    const result = await importAction({ bundle });
    setPending(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    setMessage(summaryMessage(result.summary));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-label uppercase text-ink-muted">Export everything</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={quietButtonClass}
            disabled={pending}
            onClick={() => exportAs('json')}
          >
            Export everything as JSON
          </button>
          <button
            type="button"
            className={quietButtonClass}
            disabled={pending}
            onClick={() => exportAs('markdown')}
          >
            Export as Markdown
          </button>
          <button
            type="button"
            className={quietButtonClass}
            disabled={pending}
            onClick={() => exportAs('anki')}
          >
            Export cards for Anki
          </button>
        </div>
        <p className="max-w-measure text-body-s text-ink-muted">
          JSON keeps everything — sections, concepts, tasks and your review
          history. Markdown is for reading. The Anki file is plain
          tab-separated text: flashcards and cloze cards as Front/Back rows,
          ready for File → Import in Anki.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="import-file" className="font-mono text-label uppercase text-ink-muted">
          Import a wissly export
        </label>
        <input
          id="import-file"
          type="file"
          accept="application/json"
          disabled={pending}
          onChange={onImportFile}
          className="max-w-measure text-body-s text-ink"
        />
        <p className="max-w-measure text-body-s text-ink-muted">
          Only the JSON export can be read back in. It arrives as a new
          course, alongside anything already here.
        </p>
      </div>

      {error ? (
        <p role="alert" className="border-l-2 border-l-ink pl-4 text-body-s text-ink">
          {error}
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-body-s text-ink-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
