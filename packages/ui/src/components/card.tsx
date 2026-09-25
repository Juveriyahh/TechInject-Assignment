import * as React from 'react';
import { cn } from '../lib/cn';

export type CardAccent = 'none' | 'primary' | 'success' | 'warning' | 'destructive';

const accentClasses: Record<CardAccent, string> = {
  none: '',
  primary: 'border-t-2 border-t-primary',
  success: 'border-t-2 border-t-success',
  warning: 'border-t-2 border-t-warning',
  destructive: 'border-t-2 border-t-destructive'
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds a coloured top rule, a common CRM emphasis pattern. */
  accent?: CardAccent;
}

export function Card({ className, accent = 'none', ...props }: CardProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card text-card-foreground shadow-card',
        accentClasses[accent],
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('flex flex-col gap-1 border-b border-border px-4 py-3', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return <h3 className={cn('text-lg font-semibold tracking-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('px-4 py-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn('flex items-center justify-between gap-2 border-t border-border px-4 py-3', className)}
      {...props}
    />
  );
}
