'use client';

import { CURATED_MODELS, curatedModel } from '@/lib/agent/models.js';

/* Which model answers this one line.
 *
 * A second dropdown beside the mode, and independent of it: Chat on Sonnet
 * while the Agent works on DeepSeek is an ordinary configuration, and it stays
 * ordinary because neither picker knows the other exists.
 *
 * **Three models, and only three.** There was a free field here taking any id
 * OpenRouter serves. It is gone: an open text box implies the product works
 * with the whole catalogue, and nothing here has been tried against a model
 * outside these three. `OPENROUTER_MODEL` still sets the default, so a
 * different model remains reachable — as configuration, deliberately chosen
 * once, rather than as a control offered beside every message.
 *
 * The price sits beside the name because the model decides the cost and there
 * is no spending cap in wissly, deliberately. Cost is made visible so the
 * learner can decide, which is a different thing from being decided for. */

/** `$2.00 in · $10.00 out`, per million tokens. */
export function priceOf({ input, output }) {
  return `$${input.toFixed(2)} in · $${output.toFixed(2)} out`;
}

export default function ModelPicker({ model = '', onChange, disabled = false, id = 'agent-model' }) {
  // A default set outside the three is still the model in force, so it stays
  // legible in the dropdown rather than reading as one of the three.
  const uncurated = model !== '' && !curatedModel(model) ? model : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <label htmlFor={id} className="sr-only">
        Which model answers
      </label>
      <select
        id={id}
        value={model}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        className="min-h-11 w-full max-w-full rounded-control border border-rule bg-paper px-3 font-mono text-label text-ink"
      >
        <option value="">Default model</option>
        {CURATED_MODELS.map(({ id: value, name, pricing }) => (
          <option key={value} value={value}>
            {name} · {priceOf(pricing)}
          </option>
        ))}
        {uncurated ? <option value={uncurated}>{uncurated}</option> : null}
      </select>
    </div>
  );
}
