'use client';

import * as React from 'react';
import { Lock, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { ComponentProp } from '@tech-inject/shared/contracts';
import { Badge, Button, FormField, Input, Select } from '@tech-inject/ui';
import { getPreviewRenderer, type PreviewProps } from '@/lib/preview-registry';

export interface PreviewPlaygroundProps {
  slug: string;
  propsSchema: ReadonlyArray<ComponentProp>;
  /** Locked previews render a blurred placeholder instead of the component. */
  locked?: boolean;
  /** Fixture source, shown when the slug has no registered interactive preview. */
  fixtureAvailable?: boolean;
}

function initialPropsFrom(propsSchema: ReadonlyArray<ComponentProp>): PreviewProps {
  const initial: PreviewProps = {};
  for (const prop of propsSchema) {
    if (prop.default === null || prop.default === undefined) continue;
    initial[prop.name] = typeof prop.default === 'boolean' ? prop.default : String(prop.default);
  }
  return initial;
}

/** Controls derived from the declared props schema, driving a live render. */
export function PreviewPlayground({
  slug,
  propsSchema,
  locked = false,
  fixtureAvailable = false
}: PreviewPlaygroundProps): React.JSX.Element {
  const renderer = getPreviewRenderer(slug);
  const [values, setValues] = React.useState<PreviewProps>(() => initialPropsFrom(propsSchema));

  const editableProps = propsSchema.filter(
    (prop) => prop.type === 'string' || prop.type === 'number' || prop.type === 'boolean' || prop.type === 'enum'
  );

  if (locked) {
    return (
      <div className="relative flex min-h-56 items-center justify-center overflow-hidden rounded-lg border border-border bg-card">
        <div aria-hidden className="pointer-events-none select-none blur-md">
          <div className="h-28 w-64 rounded-lg border border-border bg-muted" />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/60 px-6 text-center backdrop-blur-sm">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Lock className="h-4 w-4" />
          </span>
          <p className="text-sm font-medium">Preview locked</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            The interactive preview for premium components is available on a premium plan.
          </p>
        </div>
      </div>
    );
  }

  if (!renderer) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card px-6 text-center">
        <p className="text-sm font-medium">No interactive preview registered</p>
        <p className="max-w-md text-xs text-muted-foreground">
          {fixtureAvailable
            ? 'The preview fixture for this component is listed under the source tab. Fixture code is displayed as text and never executed in your browser.'
            : 'This component has no preview fixture yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex min-h-56 items-center justify-center rounded-lg border border-border bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] bg-card [background-size:16px_16px] p-8">
        <div className={renderer.stageClassName}>{renderer.render(values)}</div>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Props
          </span>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={() => setValues(initialPropsFrom(propsSchema))}
          >
            Reset
          </Button>
        </div>

        {editableProps.length === 0 ? (
          <p className="text-xs text-muted-foreground">This component takes no configurable props.</p>
        ) : (
          editableProps.map((prop) => {
            const controlId = `preview-${slug}-${prop.name}`;
            const current = values[prop.name];

            if (prop.type === 'boolean') {
              return (
                <label key={prop.name} htmlFor={controlId} className="flex items-center gap-2 text-sm">
                  <input
                    id={controlId}
                    type="checkbox"
                    checked={current === true}
                    onChange={(event) => setValues((prev) => ({ ...prev, [prop.name]: event.target.checked }))}
                    className="h-3.5 w-3.5 rounded-sm border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="font-mono text-xs">{prop.name}</span>
                  {prop.required ? <Badge variant="warning">required</Badge> : null}
                </label>
              );
            }

            if (prop.type === 'enum' && prop.options && prop.options.length > 0) {
              return (
                <FormField key={prop.name} htmlFor={controlId} label={prop.name}>
                  <Select
                    id={controlId}
                    value={typeof current === 'string' ? current : (prop.options[0] ?? '')}
                    onChange={(event) => setValues((prev) => ({ ...prev, [prop.name]: event.target.value }))}
                  >
                    {prop.options.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </FormField>
              );
            }

            return (
              <FormField key={prop.name} htmlFor={controlId} label={prop.name}>
                <Input
                  id={controlId}
                  type={prop.type === 'number' ? 'number' : 'text'}
                  value={current === undefined || typeof current === 'boolean' ? '' : String(current)}
                  onChange={(event) => setValues((prev) => ({ ...prev, [prop.name]: event.target.value }))}
                />
              </FormField>
            );
          })
        )}
      </div>
    </div>
  );
}
