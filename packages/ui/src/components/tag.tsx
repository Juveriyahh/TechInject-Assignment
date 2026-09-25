import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

/**
 * Categorical tag used for CRM segments and pipeline stages. Unlike `Badge`
 * (which carries semantic status), a `Tag` carries an arbitrary category, so it
 * draws from the eight-hue categorical ramp.
 */
export const tagVariants = cva(
  'inline-flex max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        blue: 'bg-tag-blue/15 text-tag-blue',
        green: 'bg-tag-green/15 text-tag-green',
        purple: 'bg-tag-purple/15 text-tag-purple',
        amber: 'bg-tag-amber/15 text-tag-amber',
        yellow: 'bg-tag-yellow/15 text-tag-yellow',
        rose: 'bg-tag-rose/15 text-tag-rose',
        cyan: 'bg-tag-cyan/15 text-tag-cyan',
        slate: 'bg-tag-slate/15 text-tag-slate'
      },
      size: {
        sm: 'px-1.5 py-0 text-[11px]',
        md: 'px-2 py-0.5 text-xs'
      }
    },
    defaultVariants: { tone: 'slate', size: 'md' }
  }
);

export type TagTone = NonNullable<VariantProps<typeof tagVariants>['tone']>;

export const TAG_TONES: readonly TagTone[] = ['blue', 'green', 'purple', 'amber', 'yellow', 'rose', 'cyan', 'slate'];

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof tagVariants> {}

export function Tag({ className, tone, size, ...props }: TagProps): React.JSX.Element {
  return <span className={cn(tagVariants({ tone, size }), className)} {...props} />;
}

/**
 * Deterministically maps a label to a tone, so the same segment always gets the
 * same colour across sessions and views without a hand-maintained table.
 */
export function toneForLabel(label: string): TagTone {
  let hash = 0;
  for (let index = 0; index < label.length; index += 1) {
    hash = (hash * 31 + label.charCodeAt(index)) >>> 0;
  }
  return TAG_TONES[hash % TAG_TONES.length] ?? 'slate';
}

export interface TagItem {
  label: string;
  tone?: TagTone;
}

export interface TagGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  tags: ReadonlyArray<TagItem | string>;
  /** Tags beyond this count collapse into a `+N` chip. */
  maxVisible?: number;
  size?: TagProps['size'];
}

/** Row of tags that collapses overflow into a `+N` chip, as CRM tables do. */
export function TagGroup({ tags, maxVisible = 2, size, className, ...props }: TagGroupProps): React.JSX.Element {
  const normalised: TagItem[] = tags.map((tag) => (typeof tag === 'string' ? { label: tag } : tag));
  const visible = normalised.slice(0, maxVisible);
  const overflow = normalised.slice(maxVisible);

  return (
    <div className={cn('flex flex-nowrap items-center gap-1.5 overflow-hidden', className)} {...props}>
      {visible.map((tag) => (
        <Tag key={tag.label} tone={tag.tone ?? toneForLabel(tag.label)} size={size} className="min-w-0">
          <span className="truncate">{tag.label}</span>
        </Tag>
      ))}
      {overflow.length > 0 ? (
        <Tag tone="slate" size={size} title={overflow.map((tag) => tag.label).join(', ')}>
          +{overflow.length}
        </Tag>
      ) : null}
    </div>
  );
}
