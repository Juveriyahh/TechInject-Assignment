'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Boxes, Crown, LogOut } from 'lucide-react';
import { Badge, Button } from '@tech-inject/ui';

export interface SiteHeaderProps {
  email: string | null;
  isPremium: boolean;
}

/** Top bar showing the signed-in customer and their plan. */
export function SiteHeader({ email, isPremium }: SiteHeaderProps): React.JSX.Element {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const signOut = async (): Promise<void> => {
    setIsSigningOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.replace('/');
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-4 w-4" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Tech Inject</span>
            <span className="text-xs text-muted-foreground">Design Library</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {email ? (
            <>
              <Badge variant={isPremium ? 'success' : 'neutral'} withDot>
                {isPremium ? (
                  <>
                    <Crown className="h-3 w-3" />
                    Premium plan
                  </>
                ) : (
                  'Free plan'
                )}
              </Badge>
              <Link href="/account" className="hidden text-sm text-muted-foreground hover:text-foreground sm:inline">
                {email}
              </Link>
              <Button
                variant="ghost"
                size="sm"
                isLoading={isSigningOut}
                leadingIcon={<LogOut className="h-4 w-4" />}
                onClick={() => void signOut()}
              >
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Badge variant="neutral">Not signed in</Badge>
              <Link href="/login">
                <Button size="sm">Sign in</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
