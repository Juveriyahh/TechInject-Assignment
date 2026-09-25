'use client';

import * as React from 'react';
import { Bell, Search } from 'lucide-react';
import { Avatar, IconButton } from '@tech-inject/ui';

export interface AppHeaderProps {
  /** Label shown in the account chip. */
  accountName: string;
  /** Unread notifications indicator. */
  hasNotifications?: boolean;
}

/** Top-right utility cluster: search, notifications and the account chip. */
export function AppHeader({ accountName, hasNotifications = false }: AppHeaderProps): React.JSX.Element {
  const [searchOpen, setSearchOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {searchOpen ? (
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search components…"
            aria-label="Search components"
            onBlur={() => setSearchOpen(false)}
            className="h-9 w-56 rounded-full border border-border bg-surface pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      ) : (
        <IconButton aria-label="Search (Ctrl+K)" onClick={() => setSearchOpen(true)}>
          <Search className="h-4 w-4" />
        </IconButton>
      )}

      <IconButton aria-label="Notifications" hasIndicator={hasNotifications}>
        <Bell className="h-4 w-4" />
      </IconButton>

      <div className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3">
        <Avatar name={accountName} size="sm" />
        <span className="hidden text-sm font-medium sm:inline">{accountName}</span>
      </div>
    </div>
  );
}
