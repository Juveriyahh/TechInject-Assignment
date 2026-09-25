'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Crown, Download, Eye, Globe, Trash2, Undo2, Upload } from 'lucide-react';
import type { ComponentRow } from '@tech-inject/database';
import {
  BarSparkline,
  Button,
  DataTable,
  FilterChip,
  LivePill,
  RowActionItem,
  RowActions,
  seededSeries,
  SegmentedMeter,
  Tabs,
  Tag,
  TagGroup,
  Toolbar,
  UserCell,
  type DataTableColumn,
  type TableSummaryItem
} from '@tech-inject/ui';

export interface ComponentsTableProps {
  components: ReadonlyArray<ComponentRow>;
}

type PendingAction = { id: string; kind: 'publish' | 'delete' } | null;
type StatusTab = 'all' | 'published' | 'draft';
type SortKey = 'updated' | 'name' | 'files' | 'category';

/** Readiness score: a component with props, dependencies and a fixture is publish-ready. */
function readinessOf(component: ComponentRow): number {
  const hasProps = component.props_schema.length > 0 ? 35 : 0;
  const hasDescription = component.description.length > 40 ? 25 : 10;
  const hasDependencies = Object.keys(component.dependencies?.npm ?? {}).length > 0 ? 20 : 10;
  const published = component.is_published ? 20 : 0;
  return Math.min(100, hasProps + hasDescription + hasDependencies + published);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export function ComponentsTable({ components }: ComponentsTableProps): React.JSX.Element {
  const router = useRouter();
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set());
  const [pending, setPending] = React.useState<PendingAction>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<StatusTab>('all');
  const [sort, setSort] = React.useState<SortKey>('updated');
  const [tier, setTier] = React.useState<'ANY' | 'FREE' | 'PREMIUM'>('ANY');
  const [category, setCategory] = React.useState('ALL');

  const categories = React.useMemo(
    () => [...new Set(components.map((component) => component.category))].sort((a, b) => a.localeCompare(b)),
    [components]
  );

  const rows = React.useMemo(() => {
    const filtered = components.filter((component) => {
      if (tab === 'published' && !component.is_published) return false;
      if (tab === 'draft' && component.is_published) return false;
      if (tier !== 'ANY' && component.tier !== tier) return false;
      if (category !== 'ALL' && component.category !== category) return false;
      return true;
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'category':
          return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        case 'files':
          return readinessOf(b) - readinessOf(a);
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });
  }, [components, tab, tier, category, sort]);

  const call = async (input: RequestInfo, init: RequestInit): Promise<boolean> => {
    setError(null);
    const response = await fetch(input, init);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Request failed with status ${String(response.status)}`);
      return false;
    }
    return true;
  };

  const togglePublished = async (component: ComponentRow): Promise<void> => {
    setPending({ id: component.id, kind: 'publish' });
    try {
      const ok = await call('/api/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ componentId: component.id, isPublished: !component.is_published })
      });
      if (ok) router.refresh();
    } finally {
      setPending(null);
    }
  };

  const publishSelected = async (isPublished: boolean): Promise<void> => {
    for (const id of selected) {
      const ok = await call('/api/publish', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ componentId: id, isPublished })
      });
      if (!ok) break;
    }
    setSelected(new Set());
    router.refresh();
  };

  const remove = async (component: ComponentRow): Promise<void> => {
    setPending({ id: component.id, kind: 'delete' });
    try {
      const ok = await call(`/api/components/${component.id}`, { method: 'DELETE' });
      if (ok) router.refresh();
    } finally {
      setPending(null);
    }
  };

  /** Downloads the rows currently in view as a JSON file. */
  const exportRows = (): void => {
    const payload = rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      category: row.category,
      tier: row.tier,
      version: row.version,
      isPublished: row.is_published,
      props: row.props_schema.length,
      updatedAt: row.updated_at
    }));

    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tech-inject-components-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const columns: ReadonlyArray<DataTableColumn<ComponentRow>> = [
    {
      id: 'name',
      header: 'Component',
      sticky: true,
      cell: (row) => (
        <div className="flex min-w-0 flex-col">
          <Link href={`/components/${row.id}`} className="truncate font-medium text-foreground hover:underline">
            {row.name}
          </Link>
          <span className="truncate font-mono text-xs text-muted-foreground">{row.slug}</span>
        </div>
      )
    },
    {
      id: 'segment',
      header: 'Category & tier',
      cell: (row) => (
        <TagGroup
          tags={[
            { label: row.category },
            { label: row.tier, tone: row.tier === 'PREMIUM' ? 'purple' : 'green' },
            ...(row.dependencies?.internal ?? []).map((name) => ({ label: name }))
          ]}
          maxVisible={2}
        />
      )
    },
    {
      id: 'owner',
      header: 'Last editor',
      cell: () => <UserCell name="Tech Inject Admin" meta="admin@techinject.dev" />
    },
    {
      id: 'files',
      header: 'Props',
      align: 'right',
      cell: (row) => <span className="tabular-nums text-foreground">{row.props_schema.length}</span>
    },
    {
      id: 'deps',
      header: 'Dependencies',
      align: 'right',
      cell: (row) => (
        <span className="tabular-nums text-muted-foreground">
          {Object.keys(row.dependencies?.npm ?? {}).length}
        </span>
      )
    },
    {
      id: 'readiness',
      header: 'Readiness',
      cell: (row) => <SegmentedMeter value={readinessOf(row)} label={`Readiness for ${row.name}`} />
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) =>
        row.is_published ? (
          <Tag tone="green">Published</Tag>
        ) : (
          <Tag tone="amber">Draft</Tag>
        )
    },
    {
      id: 'trend',
      header: 'Version trend',
      cell: (row) => (
        <BarSparkline
          values={seededSeries(row.slug)}
          tone={row.is_published ? 'success' : 'muted'}
          label={`Activity for ${row.name}`}
        />
      )
    },
    {
      id: 'updated',
      header: 'Updated',
      align: 'right',
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Calendar aria-hidden className="h-3.5 w-3.5" />
          <span className="tabular-nums">{formatDate(row.updated_at)}</span>
        </span>
      )
    }
  ];

  const publishedCount = components.filter((component) => component.is_published).length;
  const premiumCount = components.filter((component) => component.tier === 'PREMIUM').length;

  const summary: ReadonlyArray<TableSummaryItem> = [
    { label: rows.length === 1 ? 'Component in view' : 'Components in view', value: rows.length },
    { label: 'Published', value: publishedCount },
    { label: 'Premium', value: premiumCount },
    { label: 'Add calculation', placeholder: true }
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        aria-label="Component status"
        activeId={tab}
        onChange={(id) => setTab(id as StatusTab)}
        tabs={[
          { id: 'all', label: 'All', count: components.length },
          { id: 'published', label: 'Published', count: publishedCount },
          { id: 'draft', label: 'Drafts', count: components.length - publishedCount }
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Toolbar>
          <FilterChip
            label="Sort by"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            options={[
              { value: 'updated', label: 'Last updated' },
              { value: 'name', label: 'Name' },
              { value: 'category', label: 'Category' },
              { value: 'files', label: 'Readiness' }
            ]}
          />
          <FilterChip
            label="Tier"
            value={tier}
            onChange={(event) => setTier(event.target.value as 'ANY' | 'FREE' | 'PREMIUM')}
            options={[
              { value: 'ANY', label: 'Any' },
              { value: 'FREE', label: 'Free' },
              { value: 'PREMIUM', label: 'Premium' }
            ]}
          />
          <FilterChip
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            options={[
              { value: 'ALL', label: 'All' },
              ...categories.map((entry) => ({ value: entry, label: entry }))
            ]}
          />
        </Toolbar>

        <div className="flex items-center gap-2">
          {selected.size > 0 ? (
            <>
              <span className="text-sm text-muted-foreground">{selected.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => void publishSelected(true)}>
                Publish
              </Button>
              <Button variant="outline" size="sm" onClick={() => void publishSelected(false)}>
                Unpublish
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </>
          ) : null}
          <Button variant="outline" leadingIcon={<Download className="h-4 w-4" />} onClick={exportRows}>
            Export
          </Button>
          <Link href="/components/new">
            <Button leadingIcon={<Upload className="h-4 w-4" />}>New component</Button>
          </Link>
        </div>
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
        caption="All design library components, including private drafts"
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        selectedRowIds={selected}
        onSelectionChange={setSelected}
        summary={summary}
        emptyState={
          components.length === 0
            ? 'No components yet. Upload a JSON bundle to create your first draft.'
            : 'No components match these filters.'
        }
        renderRowActions={(row) => (
          <RowActions label={`Actions for ${row.name}`}>
            <Link href={`/components/${row.id}`}>
              <RowActionItem>
                <Eye className="h-4 w-4" />
                Inspect draft
              </RowActionItem>
            </Link>
            <RowActionItem
              disabled={pending?.id === row.id && pending.kind === 'publish'}
              onClick={() => void togglePublished(row)}
            >
              {row.is_published ? <Undo2 className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              {row.is_published ? 'Unpublish' : 'Publish'}
            </RowActionItem>
            <RowActionItem
              destructive
              disabled={pending?.id === row.id && pending.kind === 'delete'}
              onClick={() => void remove(row)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </RowActionItem>
          </RowActions>
        )}
      />
    </div>
  );
}

/** Page title cluster reused by the components page header. */
export function ComponentsPageTitle({ liveCount }: { liveCount: number }): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <h1 className="text-2xl font-semibold tracking-tight">Components</h1>
      <LivePill tone={liveCount > 0 ? 'success' : 'neutral'}>{liveCount} live</LivePill>
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Crown className="h-3 w-3" />
        premium gated server-side
      </span>
    </div>
  );
}
