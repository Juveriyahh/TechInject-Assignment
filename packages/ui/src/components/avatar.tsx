import * as React from 'react';
import { cn } from '../lib/cn';

export type AvatarSize = 'xs' | 'sm' | 'md';

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[10px]',
  sm: 'h-6 w-6 text-[11px]',
  md: 'h-8 w-8 text-xs'
};

/** Two-letter initials from a display name, e.g. "Alex Santos" -> "AS". */
export function initialsFrom(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/u)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/** Deterministic hue so a given person keeps the same avatar colour. */
function hueFor(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }
  return hash % 360;
}

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  /** Optional image; falls back to initials when absent or broken. */
  src?: string;
  size?: AvatarSize;
}

export function Avatar({ name, src, size = 'sm', className, ...props }: AvatarProps): React.JSX.Element {
  const hue = hueFor(name);

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-medium text-foreground ring-1 ring-border',
        sizeClasses[size],
        className
      )}
      style={src ? undefined : { backgroundColor: `hsl(${String(hue)} 45% 32%)` }}
      title={name}
      {...props}
    >
      {src ? (
        /* A plain <img> keeps this package framework-agnostic — it must not depend on next/image. */
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        initialsFrom(name)
      )}
    </span>
  );
}

export interface UserCellProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string;
  /** Secondary line, e.g. a role or email. */
  meta?: string;
  size?: AvatarSize;
}

/** Avatar + name pair, the standard "owner" cell in CRM tables. */
export function UserCell({ name, src, meta, size = 'sm', className, ...props }: UserCellProps): React.JSX.Element {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)} {...props}>
      <Avatar name={name} src={src} size={size} />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm text-foreground">{name}</span>
        {meta ? <span className="truncate text-xs text-muted-foreground">{meta}</span> : null}
      </div>
    </div>
  );
}
