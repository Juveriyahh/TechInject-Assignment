import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getComponentWithFiles, uuidSchema, type ComponentFileRow } from '@tech-inject/database';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@tech-inject/ui';
import { PageHeader } from '@/components/page-header';
import { PublishToggle } from '@/components/publish-toggle';
import { repositoryDeps } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

interface ComponentDetailPageProps {
  params: Promise<{ id: string }>;
}

const FILE_TYPE_LABEL: Record<ComponentFileRow['file_type'], string> = {
  SOURCE: 'Source',
  PREVIEW_FIXTURE: 'Preview fixture',
  STYLE: 'Style',
  METADATA: 'Metadata'
};

/**
 * Renders declared source as inert text. The admin session never imports,
 * evaluates or renders uploaded code — only displays it.
 */
function FileCard({ file }: { file: ComponentFileRow }): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <span className="font-mono text-xs text-foreground">{file.file_path}</span>
        <Badge variant="neutral">{FILE_TYPE_LABEL[file.file_type]}</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <pre className="max-h-96 overflow-auto bg-muted/40 px-4 py-3 font-mono text-xs leading-relaxed text-foreground">
          <code>{file.content}</code>
        </pre>
      </CardContent>
    </Card>
  );
}

export default async function ComponentDetailPage({ params }: ComponentDetailPageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const parsedId = uuidSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const component = await getComponentWithFiles(parsedId.data, repositoryDeps());
  if (!component) notFound();

  const npmDependencies = Object.entries(component.dependencies.npm ?? {});
  const internalDependencies = component.dependencies.internal ?? [];

  return (
    <>
      <PageHeader
        title={component.name}
        description={component.description}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/components">
              <Button variant="outline" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
                Back
              </Button>
            </Link>
            <PublishToggle componentId={component.id} isPublished={component.is_published} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          <Card accent={component.is_published ? 'success' : 'warning'}>
            <CardHeader>
              <CardTitle className="text-base">Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <Badge variant={component.is_published ? 'success' : 'warning'} withDot>
                      {component.is_published ? 'Published' : 'Draft (private)'}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Tier</dt>
                  <dd>
                    <Badge variant={component.tier === 'PREMIUM' ? 'brand' : 'neutral'}>{component.tier}</Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Slug</dt>
                  <dd className="font-mono text-xs">{component.slug}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Category</dt>
                  <dd>{component.category}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="font-mono text-xs tabular-nums">v{component.version}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">Last updated</dt>
                  <dd className="text-xs tabular-nums">{new Date(component.updated_at).toLocaleString('en-GB')}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dependencies</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">npm</p>
                {npmDependencies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None declared.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {npmDependencies.map(([name, range]) => (
                      <li key={name} className="flex items-center justify-between gap-2 font-mono text-xs">
                        <span>{name}</span>
                        <span className="text-muted-foreground">{range}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Internal UI imports
                </p>
                {internalDependencies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None declared.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {internalDependencies.map((name) => (
                      <Badge key={name} variant="brand">
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Props</CardTitle>
            </CardHeader>
            <CardContent>
              {component.props_schema.length === 0 ? (
                <p className="text-sm text-muted-foreground">No props declared.</p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {component.props_schema.map((prop) => (
                    <li key={prop.name} className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{prop.name}</span>
                        <Badge variant="neutral">{prop.type}</Badge>
                        {prop.required ? <Badge variant="warning">required</Badge> : null}
                      </div>
                      {prop.default !== undefined && prop.default !== null ? (
                        <span className="text-xs text-muted-foreground">default: {String(prop.default)}</span>
                      ) : null}
                      {prop.description ? (
                        <span className="text-xs text-muted-foreground">{prop.description}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Declared files ({component.files.length})</h2>
          {component.files.map((file) => (
            <FileCard key={file.id} file={file} />
          ))}
        </section>
      </div>
    </>
  );
}
