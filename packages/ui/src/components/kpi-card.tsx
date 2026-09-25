import * as React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { Badge, type BadgeVariant } from './badge';
import { Card, CardContent } from './card';
import { cn } from '../lib/cn';

export type MetricTrend = 'up' | 'down' | 'flat';

const trendBadgeVariant: Record<MetricTrend, BadgeVariant> = {
  up: 'success',
  down: 'error',
  flat: 'neutral'
};

const trendIcon: Record<MetricTrend, React.ComponentType<{ className?: string }>> = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight
};

export interface DataMetricProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Metric label, e.g. "Total Revenue". */
  title: string;
  /** Pre-formatted metric value, e.g. "$45,231". */
  value: string;
  /** Comparative delta, e.g. "+12.5%". */
  delta?: string;
  /** Direction of the delta; drives the badge colour and arrow. */
  trend?: MetricTrend;
  /** Context line under the metric, e.g. "vs. previous 30 days". */
  caption?: string;
  /** Optional leading icon rendered in the header row. */
  icon?: React.ReactNode;
}

/** CRM-style KPI tile: label, large value, delta badge and trend indicator. */
export function DataMetric({
  title,
  value,
  delta,
  trend = 'flat',
  caption,
  icon,
  className,
  ...props
}: DataMetricProps): React.JSX.Element {
  const TrendIcon = trendIcon[trend];

  return (
    <Card className={cn('transition-shadow hover:shadow-popover', className)} {...props}>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</span>
          {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        </div>
        <div className="flex items-end justify-between gap-3">
          <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
          {delta ? (
            <Badge variant={trendBadgeVariant[trend]}>
              <TrendIcon className="h-3 w-3" />
              {delta}
            </Badge>
          ) : null}
        </div>
        {caption ? <span className="text-xs text-muted-foreground">{caption}</span> : null}
      </CardContent>
    </Card>
  );
}

/** Alias kept for callers that prefer the `KpiCard` name. */
export const KpiCard = DataMetric;
export type KpiCardProps = DataMetricProps;
