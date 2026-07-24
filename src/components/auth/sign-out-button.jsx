import { signOut } from '@/lib/auth/actions.js';

/* A form, not a link: a link is a GET, and Next.js prefetches those — a
   prefetch would sign the learner out just by hovering. */
export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="min-h-11 rounded-[var(--radius-control)] border border-rule px-4 font-mono text-label text-ink uppercase"
      >
        Sign out
      </button>
    </form>
  );
}
