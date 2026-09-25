import * as React from 'react';
import { cn } from '../lib/cn';

const controlClasses = cn(
  'w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground shadow-xs',
  'placeholder:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive'
);

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(controlClasses, 'h-9 py-0', className)} {...props} />;
});

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...props },
  ref
) {
  return <textarea ref={ref} className={cn(controlClasses, 'min-h-24 font-mono text-xs', className)} {...props} />;
});

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(controlClasses, 'h-9 py-0', className)} {...props} />;
});

export type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps): React.JSX.Element {
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}

export interface FormFieldProps {
  /** `id` of the control this field wraps. */
  htmlFor: string;
  label: string;
  /** Helper text rendered under the control. */
  hint?: string;
  /** Validation message; replaces the hint and marks the field as invalid. */
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + hint/error triple used across admin forms. */
export function FormField({ htmlFor, label, hint, error, children, className }: FormFieldProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
