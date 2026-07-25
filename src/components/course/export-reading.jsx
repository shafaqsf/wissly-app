'use client';

import { quietButtonClass } from '@/components/artefact/control';
import { readingFileName, readingToMarkdown } from './reading-markdown';

/* Export is the one path that carries data out of the account, which is why it
   is a button the learner presses and not a tool the agent holds. The whole of
   it happens in the browser: the reading is already on the page, so building
   the file needs no request, no server action and nothing new to authorise. */

export default function ExportReading({ title, artefacts = [] }) {
  function download() {
    const blob = new Blob([readingToMarkdown({ title, artefacts })], {
      type: 'text/markdown',
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = readingFileName({ title });
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={artefacts.length === 0}
      className={quietButtonClass}
    >
      Export reading
    </button>
  );
}
