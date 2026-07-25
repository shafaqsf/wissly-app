'use server';

import { revalidatePath } from 'next/cache';

import { markUndone } from '@/lib/data/agent-runs';
import { applyUndo } from '@/lib/agent/write-tools';
import { createClient } from '@/lib/supabase/server';

/* Undo, from the dashboard row that reports the change.

   `undoRun` in `src/lib/agent/undo.js` takes back a whole run; this takes
   back one action, because "What the agent changed" lists actions and a learner
   who disagrees with one of five generations should not have to reject all
   five.

   The shape is the same one `undoRun` uses, and deliberately so: `markUndone`
   guards on `undone_at is null` inside the statement, so two clicks — or two
   tabs — resolve to one, and the inverse is only applied by whoever won the
   claim. An action whose inverse throws stays claimed rather than being
   quietly re-offered, which is the behaviour `undoRun` already has. */
export async function undoAgentAction(formData) {
  const id = String(formData?.get('actionId') ?? '');
  if (id === '') return;

  const supabase = await createClient();

  const claimed = await markUndone(supabase, { id });
  if (!claimed?.undo) return;

  await applyUndo(supabase, { undo: claimed.undo });

  revalidatePath('/dashboard');
}
