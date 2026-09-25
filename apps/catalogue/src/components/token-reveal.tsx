'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@tech-inject/ui';
import { CopyButton } from './copy-button';

export interface TokenRevealProps {
  token: string;
}

/** Masks the access token until the customer explicitly reveals it. */
export function TokenReveal({ token }: TokenRevealProps): React.JSX.Element {
  const [revealed, setRevealed] = React.useState(false);
  const masked = `${token.slice(0, 8)}${'•'.repeat(24)}${token.slice(-4)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="min-w-0 flex-1 overflow-x-auto rounded-md border border-border bg-muted/50 px-3 py-2 font-mono text-xs">
        {revealed ? token : masked}
      </code>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setRevealed((value) => !value)}
        leadingIcon={revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      >
        {revealed ? 'Hide' : 'Reveal'}
      </Button>
      <CopyButton value={token} label="Copy token" />
    </div>
  );
}
