import * as React from 'react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, DataMetric, StatusPill } from '@tech-inject/ui';

/**
 * Vetted preview renderers.
 *
 * Interactive previews are driven by *first-party* components from
 * `@tech-inject/ui`, keyed by component slug, and fed the props declared in the
 * bundle's `props_schema`. Uploaded `PREVIEW_FIXTURE` code is shown as text but
 * never compiled or evaluated — executing publisher-supplied code in the
 * visitor's browser would hand every catalogue page an arbitrary script.
 *
 * Registering a slug is therefore an explicit, reviewed step.
 */
export type PreviewProps = Record<string, string | number | boolean | undefined>;

export interface PreviewRenderer {
  /** Renders the component for the given props. */
  render: (props: PreviewProps) => React.JSX.Element;
  /** Optional wrapper classes for the preview stage. */
  stageClassName?: string;
}

const asString = (value: PreviewProps[string], fallback: string): string =>
  typeof value === 'string' && value.length > 0 ? value : fallback;

export const PREVIEW_REGISTRY: Readonly<Record<string, PreviewRenderer>> = {
  'crm-metric-card': {
    stageClassName: 'max-w-xs',
    render: (props) => {
      const trend = asString(props.trend, 'up');
      return (
        <DataMetric
          title={asString(props.title, 'Total Revenue')}
          value={asString(props.value, '$45,231')}
          delta={asString(props.delta, '+12.5%')}
          trend={trend === 'down' || trend === 'flat' ? trend : 'up'}
          caption={typeof props.caption === 'string' ? props.caption : undefined}
        />
      );
    }
  },
  'crm-status-pill': {
    render: (props) => {
      const variant = asString(props.variant, 'success');
      const allowed = ['success', 'warning', 'error', 'neutral', 'brand'] as const;
      const resolved = allowed.find((candidate) => candidate === variant) ?? 'neutral';
      return (
        <StatusPill variant={resolved} withDot={props.withDot !== false}>
          {asString(props.children, 'Qualified')}
        </StatusPill>
      );
    }
  },
  'crm-action-button': {
    render: (props) => {
      const variant = asString(props.variant, 'default');
      const allowed = ['default', 'outline', 'secondary', 'ghost', 'destructive'] as const;
      const size = asString(props.size, 'md');
      const sizes = ['sm', 'md', 'lg'] as const;
      return (
        <Button
          variant={allowed.find((candidate) => candidate === variant) ?? 'default'}
          size={sizes.find((candidate) => candidate === size) ?? 'md'}
          isLoading={props.isLoading === true}
          disabled={props.disabled === true}
        >
          {asString(props.children, 'Create deal')}
        </Button>
      );
    }
  },
  'crm-summary-card': {
    stageClassName: 'max-w-sm',
    render: (props) => (
      <Card accent="primary">
        <CardHeader>
          <CardTitle className="text-base">{asString(props.title, 'Pipeline health')}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          {asString(props.body, 'Deals are progressing 8% faster than last quarter.')}
          <Badge variant="success">{asString(props.badge, 'On track')}</Badge>
        </CardContent>
      </Card>
    )
  }
};

export function getPreviewRenderer(slug: string): PreviewRenderer | null {
  return PREVIEW_REGISTRY[slug] ?? null;
}
