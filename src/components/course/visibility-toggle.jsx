import { quietButtonClass } from '@/components/artefact/control';

/* A plain form target, like the archive verbs beside it — no state of its
   own to hold, so no `useActionState`. The hidden field carries the flag it
   is about to become, not the one it is now: the button always says the
   verb, and the server does the flipping either way. */
export default function VisibilityToggle({ courseId, isPublic, action }) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="isPublic" value={String(!isPublic)} />
      <p className="font-mono text-caption uppercase text-ink-muted">
        {isPublic ? 'Listed in the public library' : 'Only you can see this course'}
      </p>
      <button type="submit" className={quietButtonClass}>
        {isPublic ? 'Make private' : 'Make public'}
      </button>
    </form>
  );
}
