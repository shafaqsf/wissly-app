'use client';

import { useState } from 'react';
import { Archive, ArchiveRestore, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react';

/* The conversations, which the bar did not have.
 *
 * `rename`, `pin`, `archive`, `restore` and `delete` have existed as tested
 * server actions with nothing rendering them; this is where they surface. It
 * reaches for no action itself — every one of them arrives as a callback, so
 * this list can be read at a glance without a database behind it.
 *
 * Two rules shape it. **Pinned first, then recent**, with both groups named:
 * an ordering nobody can see is an ordering nobody can trust. And **deleting
 * is reachable only from the archive**, because it is the single irreversible
 * act in the product and it should take two decisions to reach, not one
 * mis-click beside "Rename". */

function nameOf(thread) {
  const title = String(thread.title ?? '').trim();
  return title === '' ? 'Untitled conversation' : title;
}

export default function ConversationList({
  threads = [],
  openId = null,
  archived = false,
  onOpen,
  onNew,
  onRename,
  onPin,
  onArchive,
  onRestore,
  onDelete,
  onShowArchived,
}) {
  const [renaming, setRenaming] = useState(null);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState(null);

  const pinned = threads.filter((thread) => thread.pinned_at);
  const recent = threads.filter((thread) => !thread.pinned_at);
  const groups = archived
    ? [['Archived', threads]]
    : [
        ['Pinned', pinned],
        ['Recent', recent],
      ];

  function startRename(thread) {
    setRenaming(thread.id);
    setDraft(nameOf(thread));
  }

  function saveName(id) {
    const title = draft.trim();
    setRenaming(null);
    if (title !== '') onRename?.(id, title);
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onNew?.()}
          className="motion-lift flex min-h-11 items-center gap-2 rounded-control border border-rule px-3 font-mono text-label uppercase"
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          New conversation
        </button>

        <button
          type="button"
          onClick={() => onShowArchived?.(!archived)}
          className="motion-lift flex min-h-11 items-center gap-2 rounded-control border border-rule px-3 font-mono text-label uppercase"
        >
          <Archive size={16} strokeWidth={1.5} aria-hidden="true" />
          {archived ? 'Show conversations' : 'Show archive'}
        </button>
      </div>

      {threads.length === 0 ? (
        <p className="max-w-measure text-body">
          Nothing here yet. Ask something and this is where the conversation
          will be waiting next time.
        </p>
      ) : null}

      {groups.map(([heading, group]) =>
        group.length === 0 ? null : (
          <section key={heading} className="flex flex-col gap-2">
            <h3 className="font-mono text-label uppercase text-ink-muted">{heading}</h3>

            <ol className="motion-stagger flex max-h-[40vh] flex-col gap-1 overflow-y-auto">
              {group.map((thread) => (
                <li
                  key={thread.id}
                  data-testid={`thread-${thread.id}`}
                  className="flex flex-col gap-1 rounded-surface border border-rule px-2 py-2"
                >
                  {renaming === thread.id ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex flex-1 flex-col gap-1">
                        <label
                          htmlFor={`rename-${thread.id}`}
                          className="font-mono text-caption text-ink-muted"
                        >
                          Conversation name
                        </label>
                        <input
                          id={`rename-${thread.id}`}
                          type="text"
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') saveName(thread.id);
                            if (event.key === 'Escape') setRenaming(null);
                          }}
                          className="min-h-11 w-full rounded-control border border-rule bg-paper px-3 text-body-s"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => saveName(thread.id)}
                        className="motion-lift min-h-11 rounded-control border border-rule px-3 font-mono text-label uppercase"
                      >
                        Save name
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpen?.(thread.id)}
                      aria-current={openId === thread.id ? 'true' : undefined}
                      className={[
                        'flex min-h-11 items-center gap-2 rounded-control px-2 text-left text-body-s',
                        // The open one is named by weight and a rule, never a fill.
                        openId === thread.id ? 'border border-ink' : 'border border-transparent',
                      ].join(' ')}
                    >
                      {thread.pinned_at ? (
                        <Pin size={14} strokeWidth={1.5} aria-hidden="true" />
                      ) : null}
                      {nameOf(thread)}
                    </button>
                  )}

                  <div className="flex flex-wrap items-center gap-1">
                    {archived ? (
                      <>
                        <RowAction
                          icon={ArchiveRestore}
                          label="Restore"
                          onClick={() => onRestore?.(thread.id)}
                        />
                        <RowAction
                          icon={Trash2}
                          label="Delete"
                          onClick={() => setConfirming(thread.id)}
                        />
                      </>
                    ) : (
                      <>
                        <RowAction
                          icon={Pencil}
                          label="Rename"
                          onClick={() => startRename(thread)}
                        />
                        <RowAction
                          icon={thread.pinned_at ? PinOff : Pin}
                          label={thread.pinned_at ? 'Unpin' : 'Pin'}
                          onClick={() => onPin?.(thread.id, !thread.pinned_at)}
                        />
                        <RowAction
                          icon={Archive}
                          label="Archive"
                          onClick={() => onArchive?.(thread.id)}
                        />
                      </>
                    )}
                  </div>

                  {/* The irreversible act asks once, in words, and rules its own
                      paragraph — the same 2px ink rule every consequence in the
                      product wears. */}
                  {confirming === thread.id ? (
                    <div
                      role="status"
                      className="flex flex-col gap-2 border-l-2 border-l-ink pl-3 text-body-s"
                    >
                      <p className="max-w-measure">
                        Deleting “{nameOf(thread)}” removes it and everything said
                        in it. This cannot be undone.
                      </p>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setConfirming(null);
                            onDelete?.(thread.id);
                          }}
                          className="motion-lift min-h-11 rounded-control border border-ink px-3 font-mono text-label uppercase"
                        >
                          Delete for good
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="motion-lift min-h-11 rounded-control border border-rule px-3 font-mono text-label uppercase"
                        >
                          Keep it
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ),
      )}
    </div>
  );
}

/* An icon never carries the meaning on its own: the verb is beside it, and it
   is the same verb the confirmation uses. */
function RowAction({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="motion-lift flex min-h-11 items-center gap-1 rounded-control border border-transparent px-2 font-mono text-caption uppercase text-ink-muted hover:text-ink"
    >
      <Icon size={14} strokeWidth={1.5} aria-hidden="true" />
      {label}
    </button>
  );
}
