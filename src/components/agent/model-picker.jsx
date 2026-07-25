'use client';

import { useState } from 'react';

import { CURATED_MODELS, curatedModel, isModelId } from '@/lib/agent/models.js';

/* Which model answers this one line.
 *
 * A second dropdown beside the mode, and independent of it: Chat on Sonnet
 * while the Agent works on DeepSeek is an ordinary configuration, and it stays
 * ordinary because neither picker knows the other exists.
 *
 * Three curated ids cover the ordinary choice and the free field takes
 * anything OpenRouter serves, because a curated list of three goes stale and
 * the catalogue has hundreds. The id is checked for *shape* only — whether
 * `nobody/nothing-at-all` exists is a question only OpenRouter can answer, and
 * asking it here would mean a network call before every send.
 *
 * The price sits beside the name because the model decides the cost and there
 * is no spending cap in wissly, deliberately. Cost is made visible so the
 * learner can decide, which is a different thing from being decided for. */

/** `$2.00 in · $10.00 out`, per million tokens. */
export function priceOf({ input, output }) {
  return `$${input.toFixed(2)} in · $${output.toFixed(2)} out`;
}

const OTHER = 'other';

const NOT_AN_ID =
  'That is not an OpenRouter model id. They are written vendor/model, like anthropic/claude-sonnet-5.';

export default function ModelPicker({ model = '', onChange, disabled = false, id = 'agent-model' }) {
  const [free, setFree] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState(null);

  // An id from the free field is still the model in force, so it stays legible
  // in the dropdown rather than disappearing behind the word "Other".
  const uncurated = model !== '' && !curatedModel(model) ? model : null;

  function choose(value) {
    if (value === OTHER) {
      setFree(true);
      setError(null);
      return;
    }

    setFree(false);
    setError(null);
    onChange?.(value);
  }

  function applyTyped() {
    const wanted = draft.trim();

    if (!isModelId(wanted)) {
      setError(NOT_AN_ID);
      return;
    }

    setError(null);
    setFree(false);
    setDraft('');
    onChange?.(wanted);
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        Which model answers
      </label>
      <select
        id={id}
        value={free ? OTHER : model}
        disabled={disabled}
        onChange={(event) => choose(event.target.value)}
        className="min-h-11 max-w-full rounded-control border border-rule bg-paper px-3 font-mono text-label text-ink"
      >
        <option value="">Default model</option>
        {CURATED_MODELS.map(({ id: value, name, pricing }) => (
          <option key={value} value={value}>
            {name} · {priceOf(pricing)}
          </option>
        ))}
        {uncurated ? <option value={uncurated}>{uncurated}</option> : null}
        <option value={OTHER}>Another model…</option>
      </select>

      {free ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor={`${id}-free`} className="font-mono text-caption text-ink-muted">
              Model id
            </label>
            <input
              id={`${id}-free`}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyTyped();
                }
              }}
              className="min-h-11 w-full rounded-control border border-rule bg-paper px-3 font-mono text-caption text-ink"
            />
          </div>
          <button
            type="button"
            onClick={applyTyped}
            className="motion-lift min-h-11 rounded-control border border-rule px-3 font-mono text-label uppercase"
          >
            Use this model
          </button>
        </div>
      ) : null}

      {/* A refusal rules its own paragraph. That 2px ink rule is the only one
          in the product, so it reads instantly without a colour. */}
      {error ? (
        <p role="status" className="border-l-2 border-l-ink pl-3 text-body-s">
          {error}
        </p>
      ) : null}
    </div>
  );
}
