import { curatedModel } from '../agent/models.js'
import { unwrap } from './result.js'

/* One row per learner, one preference in it so far: which model generation
 * reaches for when nothing more specific was chosen. See
 * `src/lib/agent/models.js` for the three tiers `resolveModel` checks, and
 * migration 016 for the table and its policies.
 *
 * The settings page offers a curated few models, not a free field — the same
 * decision the per-message picker already made, and for the same reason: a
 * model nobody here has tried against wissly should be a deliberate,
 * documented choice (`OPENROUTER_MODEL`), not a text box.
 */

const COLUMNS = 'user_id, default_model, updated_at'

/** The absence of a row, in the shape callers can read without a null check. */
const UNSET = Object.freeze({ user_id: null, default_model: null, updated_at: null })

export async function getPreferences(supabase) {
  const row = unwrap(
    await supabase.from('user_preferences').select(COLUMNS).maybeSingle(),
    'read your preferences',
  )

  return row ?? UNSET
}

/**
 * Set, or clear, the learner's default model.
 *
 * `model: null` clears the preference back to `OPENROUTER_MODEL` — the
 * environment default is still there underneath every preference, it is
 * never overwritten, only shadowed while a preference is set.
 */
export async function setDefaultModel(supabase, { userId, model, now = () => new Date() }) {
  const trimmed = model == null ? null : String(model).trim() || null

  if (trimmed !== null && !curatedModel(trimmed)) {
    throw new Error(
      `"${trimmed}" is not one of the offered models. Choose one from the list in Settings.`,
    )
  }

  return unwrap(
    await supabase
      .from('user_preferences')
      .upsert(
        { user_id: userId, default_model: trimmed, updated_at: now().toISOString() },
        { onConflict: 'user_id' },
      )
      .select(COLUMNS)
      .single(),
    'save your preferences',
  )
}
