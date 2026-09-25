'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn';

/** Horizontal control strip above a table. */
export function Toolbar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('flex flex-wrap items-center gap-2', className)} {...props} />;
}

export interface FilterChipProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Static prefix rendered inside the chip, e.g. "Sort by". */
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
}

/**
 * Label + select fused into one chip, the CRM filter-bar pattern
 * (`Sort by [Pipeline Value ⌄]`). The native `<select>` is kept for keyboard
 * and mobile behaviour and is visually merged with the label.
 */
export function FilterChip({ label, options, className, id, ...props }: FilterChipProps): React.JSX.Element {
  const generatedId = React.useId();
  const selectId = id ?? generatedId;

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-lg border border-border bg-surface pl-3 text-sm',
        'focus-within:ring-2 focus-within:ring-ring',
        className
      )}
    >
      <label htmlFor={selectId} className="shrink-0 text-muted-foreground">
        {label}
      </label>
      <div className="relative flex items-center">
        <select
          id={selectId}
          className={cn(
            'h-9 cursor-pointer appearance-none rounded-lg bg-transparent py-0 pl-2 pr-7 text-sm font-medium text-foreground',
            'focus:outline-none'
          )}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-popover text-popover-foreground">
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

export type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Accessible name; the button renders an icon only. */
  'aria-label': string;
  /** Shows a small dot, e.g. for unread notifications. */
  hasIndicator?: boolean;
};

/** Circular icon-only control used in the app header. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { className, children, hasIndicator = false, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground',
        'transition-colors hover:bg-elevated hover:text-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    >
      {children}
      {hasIndicator ? (
        <span
          aria-hidden
          className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive ring-2 ring-surface"
        />
      ) : null}
    </button>
  );
});

export interface LivePillProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'success' | 'warning' | 'neutral';
}

/** Small dotted pill beside a page title, e.g. "● Active". */
export function LivePill({ tone = 'success', className, children, ...props }: LivePillProps): React.JSX.Element {
  const dotClass =
    tone === 'success' ? 'bg-success' : tone === 'warning' ? 'bg-warning' : 'bg-muted-foreground';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground',
        className
      )}
      {...props}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
      {children}
    </span>
  );
}

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  tabs: ReadonlyArray<TabItem>;
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  'aria-label': string;
}

/** Underlined tab strip under a page title. */
export function Tabs({ tabs, activeId, onChange, className, ...props }: TabsProps): React.JSX.Element {
  return (
    <div role="tablist" className={cn('flex items-center gap-5 border-b border-border', className)} {...props}>
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 pb-2.5 pt-1 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
