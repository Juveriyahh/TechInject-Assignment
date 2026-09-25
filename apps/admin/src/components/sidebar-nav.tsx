'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Blocks,
  CircleHelp,
  FileStack,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Send,
  Users
} from 'lucide-react';
import { Button, cn } from '@tech-inject/ui';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Right-aligned count badge. */
  count?: number;
  /** Not yet implemented — rendered muted and non-interactive. */
  disabled?: boolean;
}

interface NavSection {
  label?: string;
  items: readonly NavItem[];
}

export interface SidebarNavProps {
  componentCount: number;
  customerCount: number;
  draftCount: number;
}

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function SidebarNav({ componentCount, customerCount, draftCount }: SidebarNavProps): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const sections: readonly NavSection[] = [
    {
      items: [
        { href: '/components', label: 'Components', icon: Blocks, count: componentCount },
        { href: '/', label: 'Overview', icon: LayoutDashboard },
        { href: '/components/new', label: 'Upload bundle', icon: Send },
        { href: '/customers', label: 'Customers', icon: Users, count: customerCount }
      ]
    },
    {
      label: 'Pipeline',
      items: [
        { href: '/components?status=draft', label: 'Drafts', icon: FileStack, count: draftCount },
        { href: '/components?status=published', label: 'Published', icon: ListChecks }
      ]
    },
    {
      label: 'Workspace',
      items: [
        { href: '/customers', label: 'Invite teammates', icon: Users, disabled: true },
        { href: '/', label: 'Help', icon: CircleHelp, disabled: true }
      ]
    }
  ];

  const signOut = async (): Promise<void> => {
    setIsSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/login');
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <nav aria-label="Admin sections" className="flex h-full flex-col gap-5">
      {sections.map((section, sectionIndex) => (
        <div key={section.label ?? `section-${String(sectionIndex)}`} className="flex flex-col gap-0.5">
          {section.label ? (
            <p className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </p>
          ) : null}

          {section.items.map((item) => {
            const active = !item.disabled && isActive(pathname, item.href.split('?')[0] ?? item.href);
            const content = (
              <>
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-left">{item.label}</span>
                {item.count !== undefined ? (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{item.count}</span>
                ) : null}
              </>
            );

            if (item.disabled) {
              return (
                <span
                  key={item.label}
                  aria-disabled
                  className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground/50"
                >
                  {content}
                </span>
              );
            }

            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                  active
                    ? 'border border-border bg-elevated font-medium text-foreground shadow-xs'
                    : 'border border-transparent text-muted-foreground hover:bg-elevated/60 hover:text-foreground'
                )}
              >
                {content}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-3">
        <div className="rounded-xl border border-border bg-elevated/60 p-3">
          <p className="text-sm font-semibold">{draftCount} drafts</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Waiting to be published to the catalogue.</p>
          <Link href="/components" className="mt-2.5 block">
            <Button size="sm" fullWidth>
              Review drafts
            </Button>
          </Link>
        </div>

        <Button
          variant="ghost"
          size="sm"
          fullWidth
          isLoading={isSigningOut}
          leadingIcon={<LogOut className="h-4 w-4" />}
          onClick={() => void signOut()}
          className="justify-start text-muted-foreground"
        >
          Sign out
        </Button>
      </div>
    </nav>
  );
}
