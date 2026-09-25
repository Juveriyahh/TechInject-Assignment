'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bot, Code2, Crown, Lock, Terminal } from 'lucide-react';
import { componentSourcePayloadSchema, type ComponentSourcePayload } from '@tech-inject/shared/contracts';
import { Badge, Button, cn } from '@tech-inject/ui';
import { CodeBlock } from './code-block';
import { CopyButton } from './copy-button';
import { PreviewPlayground } from './preview-playground';

export interface IntegrationPanelProps {
  slug: string;
  tier: 'FREE' | 'PREMIUM';
  /** Fixture availability is public metadata, so it is passed in from the server. */
  hasFixture: boolean;
  /** Props schema is public metadata and always rendered. */
  propsSchema: ComponentSourcePayload['propsSchema'];
}

type TabId = 'code' | 'cli' | 'prompt';

const TABS: ReadonlyArray<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'code', label: 'Copy code', icon: Code2 },
  { id: 'cli', label: 'Install command', icon: Terminal },
  { id: 'prompt', label: 'Agent prompt', icon: Bot }
];

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; payload: ComponentSourcePayload }
  | { status: 'locked'; reason: 'UNAUTHENTICATED' | 'PREMIUM_REQUIRED'; message: string }
  | { status: 'error'; message: string };

function UpgradeNotice({ state }: { state: Extract<LoadState, { status: 'locked' }> }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-10 text-center">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
        {state.reason === 'UNAUTHENTICATED' ? <Lock className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
      </span>
      <p className="text-sm font-medium">
        {state.reason === 'UNAUTHENTICATED' ? 'Sign in to continue' : 'Upgrade to Premium'}
      </p>
      <p className="max-w-md text-xs text-muted-foreground">{state.message}</p>
      <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
        {state.reason === 'UNAUTHENTICATED' ? (
          <Link href="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        ) : (
          <Button size="sm" leadingIcon={<Crown className="h-4 w-4" />} disabled>
            Upgrade to Premium
          </Button>
        )}
        <Link href="/account">
          <Button size="sm" variant="outline">
            View plan
          </Button>
        </Link>
      </div>
      {state.reason === 'PREMIUM_REQUIRED' ? (
        <p className="text-[11px] text-muted-foreground">
          Premium access is granted by the Tech Inject team from the admin dashboard.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The integration triad. The source payload is fetched from
 * `/api/components/[slug]/source`, which is the only authority on entitlement —
 * this component simply renders whatever that endpoint is willing to return, so
 * a locked state cannot be bypassed from the browser.
 */
export function IntegrationPanel({ slug, tier, hasFixture, propsSchema }: IntegrationPanelProps): React.JSX.Element {
  const [tab, setTab] = React.useState<TabId>('code');
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });

  React.useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/components/${slug}/source`, { cache: 'no-store' });
        const body: unknown = await response.json().catch(() => ({}));

        if (cancelled) return;

        if (response.status === 403) {
          const parsed = body as { error?: string; code?: 'UNAUTHENTICATED' | 'PREMIUM_REQUIRED' };
          setState({
            status: 'locked',
            reason: parsed.code ?? 'PREMIUM_REQUIRED',
            message: parsed.error ?? 'This component requires a premium plan.'
          });
          return;
        }

        if (!response.ok) {
          const parsed = body as { error?: string };
          setState({ status: 'error', message: parsed.error ?? `Request failed (${String(response.status)})` });
          return;
        }

        const payload = componentSourcePayloadSchema.safeParse(body);
        setState(
          payload.success
            ? { status: 'ready', payload: payload.data }
            : { status: 'error', message: 'The API returned an unexpected payload.' }
        );
      } catch {
        if (!cancelled) setState({ status: 'error', message: 'Network error — please retry.' });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const locked = state.status === 'locked';
  const sourceFiles = state.status === 'ready' ? state.payload.files.filter((file) => file.fileType === 'SOURCE') : [];
  const otherFiles = state.status === 'ready' ? state.payload.files.filter((file) => file.fileType !== 'SOURCE') : [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Preview</h2>
        <PreviewPlayground slug={slug} propsSchema={propsSchema} locked={locked} fixtureAvailable={hasFixture} />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Integrate</h2>
          <Badge variant={tier === 'PREMIUM' ? 'brand' : 'neutral'}>{tier}</Badge>
        </div>

        <div role="tablist" aria-label="Integration options" className="flex flex-wrap gap-1 border-b border-border">
          {TABS.map((item) => (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                tab === item.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>

        {state.status === 'loading' ? (
          <div className="h-40 animate-pulse rounded-lg border border-border bg-muted/40" />
        ) : state.status === 'error' ? (
          <p role="alert" className="rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive">
            {state.message}
          </p>
        ) : state.status === 'locked' ? (
          <UpgradeNotice state={state} />
        ) : (
          <div role="tabpanel" className="flex flex-col gap-3">
            {tab === 'code' ? (
              <>
                {sourceFiles.map((file) => (
                  <CodeBlock key={file.filePath} title={file.filePath} code={file.content} />
                ))}
                {otherFiles.map((file) => (
                  <CodeBlock key={file.filePath} title={`${file.filePath} (${file.fileType})`} code={file.content} />
                ))}
                <div className="rounded-lg border border-border bg-card p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Required dependencies
                  </p>
                  {Object.keys(state.payload.dependencies.npm).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No external npm packages required.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <CodeBlock
                        code={`npm install ${Object.entries(state.payload.dependencies.npm)
                          .map(([name, range]) => `${name}@"${range}"`)
                          .join(' ')}`}
                      />
                    </div>
                  )}
                  {state.payload.dependencies.internal.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Composes design-library primitives: {state.payload.dependencies.internal.join(', ')}
                    </p>
                  ) : null}
                </div>
              </>
            ) : null}

            {tab === 'cli' ? (
              <div className="flex flex-col gap-3">
                <CodeBlock title="Install with the CLI" code={state.payload.installCommand} />
                <p className="text-xs text-muted-foreground">
                  The installer writes the files into <code className="font-mono">components/ui/</code> by default, never
                  overwrites an existing file unless you pass <code className="font-mono">--force</code>, and prints any
                  npm packages you still need to install.
                </p>
                {tier === 'PREMIUM' ? (
                  <p className="text-xs text-muted-foreground">
                    Premium components require a token —{' '}
                    <Link href="/account" className="text-primary hover:underline">
                      copy yours from the account page
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            ) : null}

            {tab === 'prompt' ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    Paste into Cursor, Copilot Chat or ChatGPT. Includes the theme contract, props, dependencies,
                    source and verification steps.
                  </p>
                  <CopyButton value={state.payload.agentPrompt} label="Copy prompt" />
                </div>
                <CodeBlock code={state.payload.agentPrompt} />
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
