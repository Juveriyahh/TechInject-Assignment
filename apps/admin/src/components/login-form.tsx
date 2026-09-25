'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, FormField, Input } from '@tech-inject/ui';

export interface LoginFormProps {
  /** Path to land on after a successful sign-in. */
  nextPath: string;
}

export function LoginForm({ nextPath }: LoginFormProps): React.JSX.Element {
  const router = useRouter();
  const [secret, setSecret] = React.useState('');
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
        body: JSON.stringify({ secret })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Sign in failed');
        return;
      }

      setSecret('');
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
      <FormField htmlFor="admin-secret" label="Administrator secret" error={error ?? undefined}>
        <Input
          id="admin-secret"
          name="secret"
          type="password"
          autoComplete="current-password"
          required
          value={secret}
          aria-invalid={error !== null}
          onChange={(event) => setSecret(event.target.value)}
          placeholder="••••••••••••"
        />
      </FormField>
      <Button type="submit" isLoading={isSubmitting} fullWidth>
        Sign in
      </Button>
    </form>
  );
}
