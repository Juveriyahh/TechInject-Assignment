'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormField, Input } from '@tech-inject/ui';

export interface CustomerLoginFormProps {
  /** Path to return to after a successful sign-in. */
  nextPath: string;
}

export function CustomerLoginForm({ nextPath }: CustomerLoginFormProps): React.JSX.Element {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Sign in failed');
        return;
      }

      setPassword('');
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError('Network error — please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField htmlFor="email" label="Email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </FormField>

      <FormField htmlFor="password" label="Password" error={error ?? undefined}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          aria-invalid={error !== null}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
      </FormField>

      <Button type="submit" isLoading={isSubmitting} fullWidth>
        Sign in
      </Button>
    </form>
  );
}
