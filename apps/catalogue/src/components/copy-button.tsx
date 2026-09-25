'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { Button, type ButtonProps } from '@tech-inject/ui';

export interface CopyButtonProps extends Omit<ButtonProps, 'onClick' | 'children'> {
  /** Text placed on the clipboard. */
  value: string;
  label?: string;
}

/** Copy-to-clipboard button with a transient confirmation state. */
export function CopyButton({ value, label = 'Copy', ...props }: CopyButtonProps): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return undefined;
    const timeout = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timeout);
  }, [copied]);

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => void copy()}
      leadingIcon={copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {...props}
    >
      {copied ? 'Copied' : label}
    </Button>
  );
}
