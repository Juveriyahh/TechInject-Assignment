'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Undo2 } from 'lucide-react';
import { Button } from '@tech-inject/ui';

export interface PublishToggleProps {
  componentId: string;
  isPublished: boolean;
}

/** Publishes or unpublishes a component through the admin API. */
export function PublishToggle({ componentId, isPublished }: PublishToggleProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggle = async (): Promise<void> => {
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ componentId, isPublished: !isPublished })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Request failed with status ${String(response.status)}`);
        return;
      }

      router.refresh();
    } catch {
      setError('Network error — please retry.');
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={isPublished ? 'outline' : 'default'}
        isLoading={isPending}
        onClick={() => void toggle()}
        leadingIcon={isPublished ? <Undo2 className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
      >
        {isPublished ? 'Unpublish' : 'Publish'}
      </Button>
      {error ? (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      ) : null}
    </div>
  );
}
