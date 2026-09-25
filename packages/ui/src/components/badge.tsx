import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-border bg-muted text-muted-foreground',
        success: 'border-success/20 bg-success-subtle text-success',
        warning: 'border-warning/25 bg-warning-subtle text-warning-foreground',
        error: 'border-destructive/20 bg-destructive-subtle text-destructive',
        brand: 'border-primary/20 bg-accent text-accent-foreground'
      }
    },
    defaultVariants: { variant: 'neutral' }
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Renders a small filled dot before the label. */
  withDot?: boolean;
}

export function Badge({ className, variant, withDot = false, children, ...props }: BadgeProps): React.JSX.Element {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {withDot ? <span aria-hidden className="h-1.5 w-1.5 rounded-sm bg-current" /> : null}
      {children}
    </span>
  );
}

/** Semantic alias used by CRM status columns. */
export const StatusPill = Badge;
export type StatusPillProps = BadgeProps;
