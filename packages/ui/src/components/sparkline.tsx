import * as React from 'react';
import { cn } from '../lib/cn';

/**
 * Micro bar chart for an in-table trend column ("activity trend"). Bars are
 * scaled to the series maximum; the tallest bars are emphasised so the shape
 * reads at a glance in a dense row.
 */
export type SparklineTone = 'brand' | 'success' | 'muted';

const toneClasses: Record<SparklineTone, { strong: string; soft: string }> = {
  brand: { strong: 'bg-primary', soft: 'bg-primary/40' },
  success: { strong: 'bg-success', soft: 'bg-success/40' },
  muted: { strong: 'bg-muted-foreground', soft: 'bg-muted-foreground/40' }
};

export interface BarSparklineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Series values; any non-negative scale. */
  values: ReadonlyArray<number>;
  tone?: SparklineTone;
  /** Height of the plot area, in pixels. */
  height?: number;
  /** Accessible summary, e.g. "Activity over the last 8 weeks". */
  label?: string;
}

export function BarSparkline({
  values,
  tone = 'success',
  height = 20,
  label = 'Trend',
  className,
  ...props
}: BarSparklineProps): React.JSX.Element {
  const max = values.reduce((highest, value) => (value > highest ? value : highest), 0);
  const classes = toneClasses[tone];

  return (
    <div
      role="img"
      aria-label={`${label}: ${values.length} data points`}
      className={cn('flex items-end gap-[2px]', className)}
      style={{ height }}
      {...props}
    >
      {values.map((value, index) => {
        const fraction = max > 0 ? value / max : 0;
        return (
          <span
            key={index}
            className={cn('w-[3px] rounded-[1px]', fraction > 0.6 ? classes.strong : classes.soft)}
            style={{ height: `${String(Math.max(12, Math.round(fraction * 100)))}%` }}
          />
        );
      })}
    </div>
  );
}

/**
 * Deterministic pseudo-series for placeholder trends, so previews and empty
 * states stay stable between renders instead of flickering with `Math.random`.
 */
export function seededSeries(seed: string, length = 8): number[] {
  let state = 0;
  for (let index = 0; index < seed.length; index += 1) {
    state = (state * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return Array.from({ length }, () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state % 100) / 100;
  });
}
