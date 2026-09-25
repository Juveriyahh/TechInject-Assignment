'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Crown, Search } from 'lucide-react';
import type { ComponentSummary } from '@tech-inject/shared/contracts';
import { cn, Input } from '@tech-inject/ui';

export interface ComponentSearchNavProps {
  /** Published components only — the server never sends drafts to this component. */
  components: ReadonlyArray<ComponentSummary>;
}

function groupByCategory(
  components: ReadonlyArray<ComponentSummary>
): Array<{ category: string; items: ComponentSummary[] }> {
  const groups = new Map<string, ComponentSummary[]>();
  for (const component of components) {
    const existing = groups.get(component.category);
    if (existing) existing.push(component);
    else groups.set(component.category, [component]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, items]) => ({ category, items: items.sort((a, b) => a.name.localeCompare(b.name)) }));
}

/** Searchable, category-grouped component index. */
export function ComponentSearchNav({ components }: ComponentSearchNavProps): React.JSX.Element {
  const pathname = usePathname();
  const [query, setQuery] = React.useState('');

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return components;
    return components.filter((component) =>
      [component.name, component.slug, component.category, component.description]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [components, query]);

  const groups = React.useMemo(() => groupByCategory(filtered), [filtered]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search components"
          aria-label="Search components"
          className="pl-8"
        />
      </div>

      <nav aria-label="Components" className="flex flex-col gap-4">
        <Link
          href="/"
          className={cn(
            'rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
            pathname === '/' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Get started
        </Link>

        {groups.length === 0 ? (
          <p className="px-2 text-xs text-muted-foreground">
            {components.length === 0 ? 'No components published yet.' : `No matches for “${query}”.`}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.category} className="flex flex-col gap-0.5">
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.category}
              </p>
              {group.items.map((component) => {
                const href = `/components/${component.slug}`;
                const active = pathname === href;
                return (
                  <Link
                    key={component.slug}
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                      active
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <span className="truncate">{component.name}</span>
                    {component.tier === 'PREMIUM' ? (
                      <Crown aria-label="Premium" className="h-3.5 w-3.5 shrink-0 text-primary" />
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))
        )}
      </nav>
    </div>
  );
}
