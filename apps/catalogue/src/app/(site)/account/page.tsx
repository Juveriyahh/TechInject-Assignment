import Link from 'next/link';
import { Crown } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tech-inject/ui';
import { CodeBlock } from '@/components/code-block';
import { TokenReveal } from '@/components/token-reveal';
import { getServerAccessToken, getServerViewer } from '@/lib/server-viewer';

export const dynamic = 'force-dynamic';

export default async function AccountPage(): Promise<React.JSX.Element> {
  const viewer = await getServerViewer();
  const token = await getServerAccessToken();

  if (!viewer.isAuthenticated) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <Card>
          <CardContent className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">Sign in to see your plan and your CLI access token.</p>
            <Link href="/login">
              <Button>Sign in</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <p className="text-sm text-muted-foreground">
          Plan entitlement is read from the server on every request, so changes apply immediately.
        </p>
      </header>

      <Card accent={viewer.isPremium ? 'success' : 'primary'}>
        <CardHeader>
          <CardTitle className="text-base">Plan</CardTitle>
          <CardDescription>{viewer.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <Badge variant={viewer.isPremium ? 'success' : 'neutral'} withDot>
            {viewer.isPremium ? (
              <>
                <Crown className="h-3 w-3" />
                Premium
              </>
            ) : (
              'Free'
            )}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {viewer.isPremium
              ? 'You can access every published component, including premium sources.'
              : 'Free components are fully available. Premium sources require an upgrade granted by the Tech Inject team.'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CLI access token</CardTitle>
          <CardDescription>
            Pass this to the installer when adding premium components. Treat it like a password — it grants your
            entitlements until it expires.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {token ? <TokenReveal token={token} /> : <p className="text-sm text-muted-foreground">No active token.</p>}
          <CodeBlock title="Usage" code={'npx @tech-inject/cli add <slug> --token <your-access-token>'} />
        </CardContent>
      </Card>
    </div>
  );
}
