import Link from 'next/link';
import { ArrowUpRight, Blocks, CircleCheck, Crown, Upload, Users } from 'lucide-react';
import {
  listComponents,
  listProfiles,
  summariseComponents,
  summariseProfiles,
  type ComponentRow
} from '@tech-inject/database';
import {
  BarSparkline,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataMetric,
  LivePill,
  seededSeries,
  SegmentedMeter,
  Tag,
  UserCell
} from '@tech-inject/ui';
import { repositoryDeps } from '@/lib/repositories';

export const dynamic = 'force-dynamic';

function RecentRow({ component }: { component: ComponentRow }): React.JSX.Element {
  return (
    <li className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-b-0">
      <div className="flex min-w-0 flex-col">
        <Link href={`/components/${component.id}`} className="truncate text-sm font-medium hover:underline">
          {component.name}
        </Link>
        <span className="truncate font-mono text-xs text-muted-foreground">{component.slug}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <BarSparkline values={seededSeries(component.slug)} tone={component.is_published ? 'success' : 'muted'} />
        <Tag tone={component.tier === 'PREMIUM' ? 'purple' : 'green'}>{component.tier}</Tag>
        <Tag tone={component.is_published ? 'green' : 'amber'}>{component.is_published ? 'Published' : 'Draft'}</Tag>
      </div>
    </li>
  );
}

export default async function OverviewPage(): Promise<React.JSX.Element> {
  const deps = repositoryDeps();
  const [components, profiles] = await Promise.all([listComponents(deps), listProfiles(deps)]);
  const componentStats = summariseComponents(components);
  const profileStats = summariseProfiles(profiles);

  const publishRate =
    componentStats.total === 0 ? 0 : Math.round((componentStats.published / componentStats.total) * 100);
  const premiumRate =
    profileStats.total === 0 ? 0 : Math.round((profileStats.premium / profileStats.total) * 100);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
            <LivePill tone={componentStats.published > 0 ? 'success' : 'neutral'}>
              {componentStats.published} live
            </LivePill>
          </div>
          <p className="text-sm text-muted-foreground">Publishing pipeline and customer entitlements at a glance.</p>
        </div>
        <Link href="/components/new">
          <Button leadingIcon={<Upload className="h-4 w-4" />}>New component</Button>
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DataMetric
          title="Components"
          value={String(componentStats.total)}
          caption="Drafts and published entries"
          icon={<Blocks className="h-4 w-4" />}
        />
        <DataMetric
          title="Published"
          value={String(componentStats.published)}
          delta={`${String(componentStats.drafts)} in draft`}
          trend={componentStats.published > 0 ? 'up' : 'flat'}
          caption="Visible to the public catalogue"
          icon={<CircleCheck className="h-4 w-4" />}
        />
        <DataMetric
          title="Premium components"
          value={String(componentStats.premium)}
          caption="Gated behind a premium entitlement"
          icon={<Crown className="h-4 w-4" />}
        />
        <DataMetric
          title="Premium customers"
          value={`${String(profileStats.premium)} / ${String(profileStats.total)}`}
          caption={`${String(profileStats.free)} on the free tier`}
          icon={<Users className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Recently updated</CardTitle>
            <Link
              href="/components"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {components.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No components yet — upload a bundle to get started.
              </p>
            ) : (
              <ul>
                {components.slice(0, 6).map((component) => (
                  <RecentRow key={component.id} component={component} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pipeline health</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Publish rate</span>
                  <span className="tabular-nums">{publishRate}%</span>
                </div>
                <SegmentedMeter value={publishRate} segments={20} showValue={false} label="Publish rate" />
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Premium adoption</span>
                  <span className="tabular-nums">{premiumRate}%</span>
                </div>
                <SegmentedMeter value={premiumRate} segments={20} showValue={false} label="Premium adoption" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Customers</CardTitle>
              <Link href="/customers" className="text-xs font-medium text-primary hover:underline">
                Manage
              </Link>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {profiles.slice(0, 4).map((profile) => (
                <div key={profile.id} className="flex items-center justify-between gap-2">
                  <UserCell name={profile.email.split('@')[0] ?? profile.email} meta={profile.email} />
                  <Tag tone={profile.is_premium ? 'green' : 'blue'}>{profile.is_premium ? 'Premium' : 'Free'}</Tag>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
