import { Crown, UserCheck, Users } from 'lucide-react';
import { listProfiles, summariseProfiles } from '@tech-inject/database';
import { DataMetric, LivePill } from '@tech-inject/ui';
import { CustomersTable } from '@/components/customers-table';
import { repositoryDeps } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

export default async function CustomersPage(): Promise<React.JSX.Element> {
  const profiles = await listProfiles(repositoryDeps());
  const stats = summariseProfiles(profiles);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <LivePill tone={stats.premium > 0 ? 'success' : 'neutral'}>{stats.premium} premium</LivePill>
        </div>
        <p className="text-sm text-muted-foreground">
          Grant or revoke premium access. Changes apply to the next API request — no re-login required.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <DataMetric title="Accounts" value={String(stats.total)} icon={<Users className="h-4 w-4" />} />
        <DataMetric
          title="Premium"
          value={String(stats.premium)}
          caption="Entitled to premium component sources"
          icon={<Crown className="h-4 w-4" />}
        />
        <DataMetric
          title="Free tier"
          value={String(stats.free)}
          caption="Limited to FREE components"
          icon={<UserCheck className="h-4 w-4" />}
        />
      </section>

      <CustomersTable profiles={profiles} />
    </div>
  );
}
