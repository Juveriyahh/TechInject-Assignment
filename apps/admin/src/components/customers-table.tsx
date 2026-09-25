'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Crown, ShieldOff } from 'lucide-react';
import type { ProfileRow } from '@tech-inject/database';
import {
  BarSparkline,
  Button,
  DataTable,
  FilterChip,
  seededSeries,
  SegmentedMeter,
  Tag,
  Toolbar,
  UserCell,
  type DataTableColumn,
  type TableSummaryItem
} from '@tech-inject/ui';

export interface CustomersTableProps {
  profiles: ReadonlyArray<ProfileRow>;
}

type PlanFilter = 'ALL' | 'PREMIUM' | 'FREE';

/** Entitlement score used for the meter column: premium and admin rank highest. */
function entitlementScore(profile: ProfileRow): number {
  if (profile.role === 'ADMIN') return 100;
  return profile.is_premium ? 78 : 30;
}

export function CustomersTable({ profiles }: CustomersTableProps): React.JSX.Element {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [plan, setPlan] = React.useState<PlanFilter>('ALL');
  const [sort, setSort] = React.useState<'joined' | 'email' | 'plan'>('joined');
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());

  const rows = React.useMemo(() => {
    const filtered = profiles.filter((profile) => {
      if (plan === 'PREMIUM') return profile.is_premium;
      if (plan === 'FREE') return !profile.is_premium;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'email') return a.email.localeCompare(b.email);
      if (sort === 'plan') return Number(b.is_premium) - Number(a.is_premium) || a.email.localeCompare(b.email);
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [profiles, plan, sort]);

  const setPremium = async (profile: ProfileRow, isPremium: boolean): Promise<void> => {
    setPendingId(profile.id);
    setError(null);
    try {
      const response = await fetch(`/api/users/${profile.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isPremium })
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Request failed with status ${String(response.status)}`);
        return;
      }

      router.refresh();
    } catch {
      setError('Network error — please retry.');
    } finally {
      setPendingId(null);
    }
  };

  const columns: ReadonlyArray<DataTableColumn<ProfileRow>> = [
    {
      id: 'email',
      header: 'Customer',
      sticky: true,
      cell: (row) => <UserCell name={row.email.split('@')[0] ?? row.email} meta={row.email} />
    },
    {
      id: 'role',
      header: 'Role',
      cell: (row) => <Tag tone={row.role === 'ADMIN' ? 'purple' : 'slate'}>{row.role}</Tag>
    },
    {
      id: 'plan',
      header: 'Plan',
      cell: (row) => <Tag tone={row.is_premium ? 'green' : 'blue'}>{row.is_premium ? 'Premium' : 'Free'}</Tag>
    },
    {
      id: 'entitlement',
      header: 'Entitlement',
      cell: (row) => <SegmentedMeter value={entitlementScore(row)} label={`Entitlement for ${row.email}`} />
    },
    {
      id: 'activity',
      header: 'Access trend',
      cell: (row) => (
        <BarSparkline
          values={seededSeries(row.email)}
          tone={row.is_premium ? 'success' : 'muted'}
          label={`Access trend for ${row.email}`}
        />
      )
    },
    {
      id: 'created',
      header: 'Joined',
      align: 'right',
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Calendar aria-hidden className="h-3.5 w-3.5" />
          <span className="tabular-nums">
            {new Date(row.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
          </span>
        </span>
      )
    }
  ];

  const premiumCount = profiles.filter((profile) => profile.is_premium).length;

  const summary: ReadonlyArray<TableSummaryItem> = [
    { label: rows.length === 1 ? 'Customer in view' : 'Customers in view', value: rows.length },
    { label: 'Premium', value: premiumCount },
    { label: 'Free', value: profiles.length - premiumCount },
    { label: 'Add calculation', placeholder: true }
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Toolbar>
          <FilterChip
            label="Sort by"
            value={sort}
            onChange={(event) => setSort(event.target.value as 'joined' | 'email' | 'plan')}
            options={[
              { value: 'joined', label: 'Joined' },
              { value: 'email', label: 'Email' },
              { value: 'plan', label: 'Plan' }
            ]}
          />
          <FilterChip
            label="Plan"
            value={plan}
            onChange={(event) => setPlan(event.target.value as PlanFilter)}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'PREMIUM', label: 'Premium' },
              { value: 'FREE', label: 'Free' }
            ]}
          />
        </Toolbar>

        {selected.size > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} selected</span>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Crown className="h-4 w-4" />}
              onClick={() => {
                for (const profile of profiles.filter((candidate) => selected.has(candidate.id))) {
                  void setPremium(profile, true);
                }
                setSelected(new Set());
              }}
            >
              Grant premium
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <DataTable
        caption="Registered customer accounts and their premium entitlement"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        selectedRowIds={selected}
        onSelectionChange={setSelected}
        summary={summary}
        emptyState="No customers yet. Run `pnpm db:seed` to create the demo accounts."
        renderRowActions={(row) => (
          <Button
            size="sm"
            variant={row.is_premium ? 'outline' : 'default'}
            isLoading={pendingId === row.id}
            onClick={() => void setPremium(row, !row.is_premium)}
            leadingIcon={row.is_premium ? <ShieldOff className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
          >
            {row.is_premium ? 'Revoke' : 'Grant'}
          </Button>
        )}
      />
    </div>
  );
}
