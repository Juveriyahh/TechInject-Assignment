import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Boxes } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@tech-inject/ui';
import { CustomerLoginForm } from '@/components/customer-login-form';
import { getServerViewer } from '@/lib/server-viewer';

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps): Promise<React.JSX.Element> {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') ? next : '/';

  const viewer = await getServerViewer();
  if (viewer.isAuthenticated) redirect(safeNext);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm" accent="primary">
        <CardHeader>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Boxes className="h-4 w-4" />
          </span>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Access your plan, premium sources and CLI token.</CardDescription>
        </CardHeader>
        <CardContent>
          <CustomerLoginForm nextPath={safeNext} />
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            Back to the catalogue
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
