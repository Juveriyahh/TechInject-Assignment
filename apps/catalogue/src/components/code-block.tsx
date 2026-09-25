import * as React from 'react';
import { cn } from '@tech-inject/ui';
import { CopyButton } from './copy-button';

export interface CodeBlockProps {
  code: string;
  /** Shown in the header strip, usually the file path. */
  title?: string;
  className?: string;
  /** Blurs the content and disables selection for locked premium previews. */
  obscured?: boolean;
}

/**
 * Renders code as inert text. Component sources fetched from the API are never
 * evaluated — they are displayed inside a `<pre>` and nothing else.
 */
export function CodeBlock({ code, title, className, obscured = false }: CodeBlockProps): React.JSX.Element {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-card', className)}>
      {title ? (
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-3 py-2">
          <span className="truncate font-mono text-xs text-muted-foreground">{title}</span>
          {obscured ? null : <CopyButton value={code} label="Copy" />}
        </div>
      ) : null}
      <pre
        aria-hidden={obscured}
        className={cn(
          'max-h-[28rem] overflow-auto px-4 py-3 font-mono text-xs leading-relaxed text-foreground',
          obscured && 'select-none blur-sm'
        )}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
