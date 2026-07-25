'use client';

import { quietButtonClass } from '@/components/artefact/control';
import { exportFilename, flashcardsAsAnki, flashcardsAsCsv } from './export';

/* The two buttons that carry cards out of the account.

   The file is built in the browser out of rows this page already has, so
   nothing new is exposed and there is no endpoint for a tool to call. That is
   deliberate — see the agent's reach in the four-areas design: auth and export
   stay out of reach, and this is what "out of reach" looks like in code. */
export default function ExportButtons({ tasks = [], course }) {
  function download(text, extension, mime) {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const link = document.createElement('a');

    link.href = url;
    link.download = exportFilename({ course, extension });
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (tasks.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => download(flashcardsAsCsv(tasks), 'csv', 'text/csv;charset=utf-8')}
        className={quietButtonClass}
      >
        Export as CSV
      </button>
      <button
        type="button"
        onClick={() => download(flashcardsAsAnki(tasks), 'txt', 'text/plain;charset=utf-8')}
        className={quietButtonClass}
      >
        Export for Anki
      </button>
    </div>
  );
}
