'use client';

import { Undo2, X } from 'lucide-react';

import { curatedModel } from '@/lib/agent/models.js';

import { MODES } from '@/components/agent/mode-picker';

/* What has been said, what state each turn is in, and what it changed.
 *
 * Every one of those is carried by words, by an ink rule and by weight —
 * never by a hue. A failed turn wears the 2px `--ink` left border that nothing
 * else in the product has, so it reads instantly at a glance and reads exactly
 * the same in a screenshot, in high contrast and to a screen reader. A queued
 * one says "Waiting". A run that changed something counts the changes in
 * words next to the button that takes them back.
 *
 * Four facts ride on every line and all four are the same mono label, because
 * they are the system talking about itself rather than about the subject:
 *
 *   You · Agent · Claude Sonnet 5 · Waiting
 *
 * Mode is per message, so a thread that started in Chat and moved to Agent
 * says so line by line rather than making the learner remember. */

const STATUS_WORDS = {
  queued: 'Waiting',
  running: 'Working',
  stopped: 'Stopped',
  failed: 'Not sent',
};

const SPEAKER = { user: 'You', assistant: 'wissly' };

function modeWord(mode) {
  return MODES.find((entry) => entry.id === mode)?.label ?? null;
}

/* A curated model is named; anything from the free field is shown as the id
   the learner typed. Saying nothing at all would hide what a line cost. */
function modelWord(model) {
  if (!model) return null;
  return curatedModel(model)?.name ?? model;
}

/** "8 changes" / "1 change" — counted, because a count is a decision. */
function changes(count) {
  return `${count} ${count === 1 ? 'change' : 'changes'}`;
}

export default function Transcript({
  messages = [],
  working = false,
  runs = {},
  intents = {},
  onWithdraw,
  onUndo,
}) {
  if (messages.length === 0) {
    return (
      <p className="max-w-measure px-4 py-8 text-body">
        Ask about anything you have added. Answers come from your material and
        say which page they came from.
      </p>
    );
  }

  return (
    <ol className="motion-stagger flex max-h-[50vh] flex-col gap-6 overflow-y-auto px-4 py-6">
      {messages.map((message) => {
        const run = runs[message.id] ?? null;
        const went = intents[message.id] ?? [];
        const anchors = message.anchors ?? [];
        const failed = message.status === 'failed';
        const meta = [
          SPEAKER[message.role] ?? SPEAKER.assistant,
          modeWord(message.mode),
          modelWord(message.model),
          STATUS_WORDS[message.status],
        ].filter(Boolean);

        return (
          <li
            key={message.id}
            data-testid={`turn-${message.id}`}
            className={[
              'flex flex-col gap-2',
              // The rule goes on the message, never on the surface around it:
              // a 2px side mitring across a rounded panel corner visibly
              // un-rounds it at both ends. See "No status colours".
              failed ? 'border-l-2 border-l-ink pl-3' : '',
            ].join(' ')}
          >
            <p
              data-testid={`meta-${message.id}`}
              className="flex flex-wrap items-center gap-2 font-mono text-label uppercase"
            >
              {meta.join(' · ')}

              {/* Withdrawing is a deliberate act with its own verb. Stop ends
                  the turn that is running; this takes back one that has not
                  started, and only one that has not started. */}
              {message.status === 'queued' && onWithdraw ? (
                <button
                  type="button"
                  onClick={() => onWithdraw(message.id)}
                  className="motion-lift flex min-h-11 items-center gap-1 rounded-control border border-rule px-2 font-mono text-label uppercase"
                >
                  <X size={14} strokeWidth={1.5} aria-hidden="true" />
                  Withdraw
                </button>
              ) : null}
            </p>

            {message.content ? (
              <p className="max-w-measure whitespace-pre-wrap text-body">{message.content}</p>
            ) : (
              <p className="max-w-measure text-body">
                {working || message.status === 'running'
                  ? 'Reading your material.'
                  : 'Nothing came back.'}
              </p>
            )}

            {anchors.length > 0 ? (
              <div data-testid={`anchors-${message.id}`} className="flex flex-col gap-1">
                <p className="font-mono text-caption text-ink-muted">From your material</p>
                <ol className="flex flex-wrap gap-1">
                  {anchors.map((anchor, index) => (
                    <li
                      key={anchor.section_id ?? index}
                      // A citation mark takes the control radius so its focus
                      // ring is round like everything else.
                      className="rounded-control border border-rule px-2 py-1 font-mono text-caption"
                    >
                      Passage {index + 1}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {/* A silent page change is disorienting: the agent may drive the
                interface, and when it does the transcript says where it went. */}
            {went.length > 0 ? (
              <p className="font-mono text-caption text-ink-muted">
                Opened {went.map((intent) => intent.label).join(', ')}
              </p>
            ) : null}

            {run ? <RunReport failed={failed} run={run} onUndo={onUndo} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/* What the run behind this message did, and what is left of it.
 *
 * A run of thirty writes that dies on the twenty-ninth has changed the
 * learner's material twenty-eight times. Reporting only "that did not work"
 * would leave them to guess whether to undo, so the two facts are separated:
 * what completed before it stopped, and how much of it can still be taken
 * back. The second is the count `runActionsAction` returns as `outstanding`,
 * which is not the same number — a write with nothing to reverse is done and
 * gone. */
function RunReport({ failed, run, onUndo }) {
  // `null` is "not counted", which is not the same as "nothing to take back":
  // a stream that names no run cannot be counted, and a turn whose changes
  // cannot be counted is still a turn whose changes can be reversed.
  const outstanding = run.outstanding === undefined ? 0 : run.outstanding;
  const completed = run.completed ?? [];

  return (
    <div className="flex flex-col gap-2">
      {failed ? (
        <p className="max-w-measure text-body-s">
          {completed.length > 0
            ? `Before it stopped it completed: ${completed.join(', ')}.`
            : 'Nothing was changed before it stopped.'}
        </p>
      ) : null}

      {run.undone ? (
        <p className="font-mono text-caption text-ink-muted">These changes were taken back.</p>
      ) : (outstanding === null || outstanding > 0) && onUndo ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-caption text-ink-muted">
            {outstanding === null
              ? 'Anything this changed can be taken back'
              : `${changes(outstanding)} to your material`}
          </p>
          <button
            type="button"
            onClick={() => onUndo(run.runId)}
            className="motion-lift flex min-h-11 items-center gap-2 rounded-control border border-rule px-3 font-mono text-label uppercase"
          >
            <Undo2 size={16} strokeWidth={1.5} aria-hidden="true" />
            Take these changes back
          </button>
        </div>
      ) : null}
    </div>
  );
}
