import Link from 'next/link';
import { Boxes } from 'lucide-react';
import { listComponents, listProfiles, summariseComponents } from '@tech-inject/database';
import { AppHeader } from '@/components/app-header';
import { SidebarNav } from '@/components/sidebar-nav';
import { repositoryDeps } from '@/lib/repositories';
import { requireAdminSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  // Cryptographic session verification in the Node runtime.
  await requireAdminSession();

  const deps = repositoryDeps();
  const [components, profiles] = await Promise.all([listComponents(deps), listProfiles(deps)]);
  const stats = summariseComponents(components);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface px-3 py-4 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-1.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
            <Boxes className="h-4.5 w-4.5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Design Library</span>
            <span className="text-xs text-muted-foreground">Publishing console</span>
          </span>
        </Link>

        <SidebarNav
          componentCount={stats.total}
          customerCount={profiles.length}
          draftCount={stats.drafts}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-3 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <AppHeader accountName="Tech Inject Admin" hasNotifications={stats.drafts > 0} />
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
