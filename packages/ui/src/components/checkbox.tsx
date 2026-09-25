'use client';

import * as React from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '../lib/cn';

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  /** Renders the mixed state used by "select all" headers. */
  indeterminate?: boolean;
  /** Accessible name; required because the control renders no visible text. */
  'aria-label': string;
}

/**
 * Selection checkbox styled with the amber selection token, matching the CRM
 * row-selection affordance. Built on a real `<input type="checkbox">` so it
 * keeps native keyboard behaviour and form semantics.
 */
export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, indeterminate = false, checked, disabled, ...props },
  forwardedRef
) {
  const innerRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(forwardedRef, () => innerRef.current as HTMLInputElement);

  React.useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const active = indeterminate || checked === true;

  return (
    <span className={cn('relative inline-flex h-4 w-4 shrink-0 items-center justify-center', className)}>
      <input
        ref={innerRef}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className={cn(
          'peer h-4 w-4 cursor-pointer appearance-none rounded-[4px] border transition-colors',
          'border-border-strong bg-transparent',
          'hover:border-selection/60',
          'checked:border-selection checked:bg-selection indeterminate:border-selection indeterminate:bg-selection',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
        {...props}
      />
      {active ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-selection-foreground"
        >
          {indeterminate ? <Minus className="h-3 w-3" strokeWidth={3} /> : <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      ) : null}
    </span>
  );
});
