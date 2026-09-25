'use client';

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../lib/cn';

export interface RowActionsProps {
  /** Menu items; usually `RowActionItem` or `RowActionLink` elements. */
  children: React.ReactNode;
  /** Accessible name for the trigger button. */
  label?: string;
  className?: string;
}

/**
 * Lightweight per-row action menu. Uses a native popover-free pattern (click
 * outside + Escape) so it stays dependency-free and server-render safe.
 */
export function RowActions({ children, label = 'Row actions', className }: RowActionsProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn('relative inline-block text-left', className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground',
          'transition-colors hover:bg-secondary hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-40 overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-popover"
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export interface RowActionItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Renders the item in the destructive colour. */
  destructive?: boolean;
}

export function RowActionItem({ className, destructive = false, ...props }: RowActionItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
        'transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:bg-secondary',
        'disabled:pointer-events-none disabled:opacity-50',
        destructive ? 'text-destructive hover:bg-destructive-subtle' : 'text-foreground',
        className
      )}
      {...props}
    />
  );
}
