import * as React from 'react';
import { cn } from '../lib/cn';

/**
 * Segmented probability meter — the "win probability" column of a CRM table.
 * Segments fill left to right and run through the low → mid → high ramp, so the
 * colour itself encodes confidence without needing to read the number.
 */
export interface SegmentedMeterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  /** Number of segments drawn. */
  segments?: number;
  /** Renders the percentage next to the meter. */
  showValue?: boolean;
  /** Accessible label, e.g. "Win probability". */
  label?: string;
}

function colourForFraction(fraction: number): string {
  if (fraction < 0.34) return 'hsl(var(--chart-low))';
  if (fraction < 0.67) return 'hsl(var(--chart-mid))';
  return 'hsl(var(--chart-high))';
}

export function SegmentedMeter({
  value,
  segments = 12,
  showValue = true,
  label = 'Progress',
  className,
  ...props
}: SegmentedMeterProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const filled = Math.round((clamped / 100) * segments);

  return (
    <div
      role="meter"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('flex items-center gap-2.5', className)}
      {...props}
    >
      <div aria-hidden className="flex items-center gap-[2px]">
        {Array.from({ length: segments }, (_, index) => {
          const isFilled = index < filled;
          return (
            <span
              key={index}
              className="h-3.5 w-[3px] rounded-[1px]"
              style={{
                backgroundColor: isFilled
                  ? colourForFraction((index + 1) / segments)
                  : 'hsl(var(--chart-track))'
              }}
            />
          );
        })}
      </div>
      {showValue ? (
        <span className="w-9 text-right text-sm tabular-nums text-foreground">{Math.round(clamped)}%</span>
      ) : null}
    </div>
  );
}
