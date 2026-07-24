import Link from 'next/link';

import AuthForm from '@/components/auth/auth-form';
import { signUp } from '@/lib/auth/actions.js';

export const metadata = {
  title: 'Create your account — wissly',
};

export default async function SignUpPage() {
  return (
    <>
      <header className="flex flex-col gap-3">
        <p className="font-mono text-label text-ink-muted uppercase">wissly</p>
        <h1 className="font-display text-display-l font-bold">Create your account</h1>
        <p className="text-body-s text-ink-muted">
          Everything you upload stays yours, and stays yours alone.
        </p>
      </header>

      <AuthForm mode="sign-up" action={signUp} />

      <p className="border-rule border-t pt-6 text-body-s text-ink-muted">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-ink underline underline-offset-4">
          Sign in
        </Link>
        .
      </p>
    </>
  );
}
