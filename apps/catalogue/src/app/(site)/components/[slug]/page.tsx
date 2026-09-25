import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Crown } from 'lucide-react';
import { getPublishedComponentWithFiles, slugSchema } from '@tech-inject/database';
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@tech-inject/ui';
import { IntegrationPanel } from '@/components/integration-panel';
import { repositoryDeps } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

interface ComponentPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Public component page.
 *
 * The server sends only *public* metadata — name, description, category, tier,
 * version and the props schema. File contents are never embedded in the HTML;
 * the client fetches them from `/api/components/[slug]/source`, which enforces
 * entitlement. An unpublished slug 404s here exactly as it does in the API.
 */
async function loadComponent(rawSlug: string) {
  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) return null;
  return getPublishedComponentWithFiles(parsed.data, repositoryDeps());
}

export async function generateMetadata({ params }: ComponentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const component = await loadComponent(slug);

  if (!component) return { title: 'Component not found — Tech Inject' };
  return {
    title: `${component.name} — Tech Inject Design Library`,
    description: component.description
  };
}

export default async function ComponentPage({ params }: ComponentPageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const component = await loadComponent(slug);
  if (!component) notFound();

  const hasFixture = component.files.some((file) => file.file_type === 'PREVIEW_FIXTURE');
  const propsSchema = component.props_schema;

  return (
    <div className="flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{component.category}</span>
          <span aria-hidden>·</span>
          <span className="font-mono">v{component.version}</span>
          <span aria-hidden>·</span>
          <span className="font-mono">{component.slug}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{component.name}</h1>
          <Badge variant={component.tier === 'PREMIUM' ? 'brand' : 'neutral'}>
            {component.tier === 'PREMIUM' ? (
              <>
                <Crown className="h-3 w-3" />
                Premium
              </>
            ) : (
              'Free'
            )}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{component.description}</p>
      </header>

      <IntegrationPanel
        slug={component.slug}
        tier={component.tier}
        hasFixture={hasFixture}
        propsSchema={propsSchema}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Props</h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API reference</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {propsSchema.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">This component takes no props.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-muted/60">
                    <tr className="border-b border-border">
                      {['Prop', 'Type', 'Required', 'Default'].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {propsSchema.map((prop) => (
                      <tr key={prop.name} className="border-b border-border last:border-b-0">
                        <td className="px-4 py-2.5 font-mono text-xs">{prop.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {prop.type === 'enum' && prop.options
                            ? prop.options.map((option) => `'${option}'`).join(' | ')
                            : prop.type}
                        </td>
                        <td className="px-4 py-2.5">
                          {prop.required ? <Badge variant="warning">required</Badge> : <span className="text-xs text-muted-foreground">optional</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                          {prop.default === undefined || prop.default === null ? '—' : String(prop.default)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        {propsSchema.length > 0 ? (
          <details className="rounded-lg border border-border bg-card px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium">Raw props_schema JSON</summary>
            <pre className="mt-3 max-h-80 overflow-auto font-mono text-xs text-muted-foreground">
              <code>{JSON.stringify(propsSchema, null, 2)}</code>
            </pre>
          </details>
        ) : null}
      </section>
    </div>
  );
}
