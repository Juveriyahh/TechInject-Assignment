import { listPublishedComponents } from '@tech-inject/database';
import type { ComponentSummary } from '@tech-inject/shared/contracts';
import { ComponentSearchNav } from '@/components/component-search-nav';
import { SiteHeader } from '@/components/site-header';
import { repositoryDeps } from '@/lib/repositories';
import { getServerViewer } from '@/lib/server-viewer';

export const dynamic = 'force-dynamic';

export default async function SiteLayout({ children }: { children: React.ReactNode }): Promise<React.JSX.Element> {
  // Only published components ever reach the client.
  const [components, viewer] = await Promise.all([listPublishedComponents(repositoryDeps()), getServerViewer()]);

  const summaries: ComponentSummary[] = components.map((component) => ({
    slug: component.slug,
    name: component.name,
    description: component.description,
    category: component.category,
    tier: component.tier,
    version: component.version,
    updatedAt: component.updated_at
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader email={viewer.email} isPremium={viewer.isPremium} />

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-20">
            <ComponentSearchNav components={summaries} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <footer className="border-t border-border py-6">
        <div className="mx-auto w-full max-w-7xl px-4 text-xs text-muted-foreground">
          Tech Inject Design Library · {summaries.length} published component
          {summaries.length === 1 ? '' : 's'}
        </div>
      </footer>
    </div>
  );
}
