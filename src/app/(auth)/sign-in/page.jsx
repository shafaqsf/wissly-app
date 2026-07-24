import Link from 'next/link';

import AuthForm from '@/components/auth/auth-form';
import { signIn } from '@/lib/auth/actions.js';

export const metadata = {
  title: 'Sign in — wissly',
};

export default async function SignInPage({ searchParams }) {
  // The proxy records where a signed-out visitor was heading.
  const { next = '' } = (await searchParams) ?? {};

  return (
    <>
      <header className="flex flex-col gap-3">
        <p className="font-mono text-label text-ink-muted uppercase">wissly</p>
        <h1 className="font-display text-display-l font-bold">Sign in</h1>
        <p className="text-body-s text-ink-muted">
          Your subjects, sources and progress are tied to your account.
        </p>
      </header>

      <AuthForm mode="sign-in" action={signIn} next={next} />

      <p className="border-rule border-t pt-6 text-body-s text-ink-muted">
        No account yet?{' '}
        <Link href="/sign-up" className="text-ink underline underline-offset-4">
          Create one
        </Link>
        .
      </p>
    </>
  );
}
