import { signOut } from '@/lib/auth/actions.js';
import { quietButtonClass } from '@/components/artefact/control.js';

/* A form, not a link: a link is a GET, and Next.js prefetches those — a
   prefetch would sign the learner out just by hovering. */
export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className={quietButtonClass}
      >
        Sign out
      </button>
    </form>
  );
}
