'use client';

import { useState, useTransition } from 'react';

import { priceOf } from '@/components/agent/model-picker';
import { CURATED_MODELS } from '@/lib/agent/models.js';

/* Which model generation reaches for, as a stored preference rather than a
 * choice made anew on every message.
 *
 * This is the other end of the picker beside the agent bar's field: that one
 * chooses per message and forgets the choice the moment the thread moves on.
 * This one is what a message that chose nothing falls back to — one step
 * above `OPENROUTER_MODEL`, and it is what `make_artefacts` reaches for too,
 * see `src/lib/agent/run.js`.
 *
 * Same three curated models, same reason there is no free field: nothing here
 * has been tried against wissly outside the three, and offering the whole
 * catalogue would make the choice look larger than the product actually
 * supports.
 *
 * Saves as it changes rather than behind a submit button — a preference this
 * small does not need a second click to confirm. */
export default function ModelPreferenceForm({ defaultModel = '', action }) {
  const [model, setModel] = useState(defaultModel);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function choose(next) {
    setModel(next);
    setError(null);

    startTransition(async () => {
      const result = await action({ model: next });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="default-model" className="font-mono text-label uppercase text-ink-muted">
        Model for generation
      </label>

      <select
        id="default-model"
        value={model}
        disabled={pending}
        onChange={(event) => choose(event.target.value)}
        className="min-h-11 w-full max-w-measure rounded-control border border-rule bg-paper px-3 font-mono text-label text-ink"
      >
        <option value="">Environment default</option>
        {CURATED_MODELS.map(({ id, name, pricing }) => (
          <option key={id} value={id}>
            {name} · {priceOf(pricing)}
          </option>
        ))}
      </select>

      <p className="max-w-measure text-body-s text-ink-muted">
        What answers when the agent generates reading and tasks from your
        material, unless a message chooses a different one.
      </p>

      {error ? (
        <p role="alert" className="border-l-2 border-l-ink pl-4 text-body-s text-ink">
          {error}
        </p>
      ) : null}
    </div>
  );
}
