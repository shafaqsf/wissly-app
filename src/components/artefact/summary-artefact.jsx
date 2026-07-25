'use client';

import { useState } from 'react';
import Prose from './prose';
import CitationAnchor from './citation-anchor';

/* A summary is the same material at three depths — the payload has exactly
   three keys and they are these. The learner chooses how far in to go; the
   choice is a radio set, because the depths are exclusive and all three
   should be visible at once rather than discovered one click at a time. */
const LAYERS = [
  { key: 'three_sentences', label: 'Three sentences' },
  { key: 'paragraph', label: 'A paragraph' },
  { key: 'full', label: 'Full depth' },
];

function layerText(payload, key) {
  const value = payload[key];
  return Array.isArray(value) ? value.join(' ') : value;
}

export default function SummaryArtefact({ artefact }) {
  const [layerKey, setLayerKey] = useState(LAYERS[0].key);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-mono text-label uppercase text-ink-muted">
          Depth
        </legend>
        <div className="flex flex-wrap gap-2">
          {LAYERS.map((layer) => (
            <label
              key={layer.key}
              className={[
                'inline-flex min-h-11 cursor-pointer items-center rounded-control border px-4 font-mono text-label uppercase',
                // The radio inside is `sr-only`, so the ring has to be drawn
                // on the thing anyone can actually see. Same 2px ink at 2px
                // offset as the interaction floor everywhere else.
                'has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink',
                layer.key === layerKey
                  ? 'border-ink text-ink'
                  : 'border-rule text-ink-muted hover:text-ink',
              ].join(' ')}
            >
              <input
                type="radio"
                name={`${artefact.id}-depth`}
                value={layer.key}
                checked={layer.key === layerKey}
                onChange={() => setLayerKey(layer.key)}
                className="sr-only"
              />
              {layer.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Prose text={layerText(artefact.payload, layerKey)} />
        <p className="max-w-measure text-body-s text-ink-muted">
          Summarised from
          <CitationAnchor
            ordinal={artefact.section_ordinal}
            anchor={artefact.anchor}
            passage={artefact.passage}
          />
        </p>
      </div>
    </div>
  );
}
