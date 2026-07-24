'use client';

import { useState } from 'react';
import Prose from './prose';

/* A summary is the same material at three depths. The learner chooses how far
   in to go; the choice is a radio set, because the depths are exclusive and a
   learner should see all three at once rather than discover them one click at
   a time. */
export default function SummaryArtefact({ artefact }) {
  const { layers } = artefact.payload;
  const [layerId, setLayerId] = useState(layers[0].id);
  const layer = layers.find((item) => item.id === layerId) ?? layers[0];

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-mono text-label uppercase text-ink-muted">
          Depth
        </legend>
        <div className="flex flex-wrap gap-2">
          {layers.map((item) => (
            <label
              key={item.id}
              className={[
                'inline-flex min-h-11 cursor-pointer items-center rounded-control border px-4 font-mono text-label uppercase',
                item.id === layer.id
                  ? 'border-ink text-ink'
                  : 'border-rule text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              <input
                type="radio"
                name={`${artefact.id}-depth`}
                value={item.id}
                checked={item.id === layer.id}
                onChange={() => setLayerId(item.id)}
                className="sr-only"
              />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>

      <Prose blocks={layer.blocks} sources={artefact.sources} />
    </div>
  );
}
