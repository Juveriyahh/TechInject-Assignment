import { listComponents } from '@tech-inject/database';
import { ComponentsPageTitle, ComponentsTable } from '@/components/components-table';
import { repositoryDeps } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

export default async function ComponentsPage(): Promise<React.JSX.Element> {
  const components = await listComponents(repositoryDeps());
  const liveCount = components.filter((component) => component.is_published).length;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <ComponentsPageTitle liveCount={liveCount} />
        <p className="text-sm text-muted-foreground">
          Drafts stay private until you publish them. Unpublishing revokes public access immediately.
        </p>
      </header>

      <ComponentsTable components={components} />
    </div>
  );
}
