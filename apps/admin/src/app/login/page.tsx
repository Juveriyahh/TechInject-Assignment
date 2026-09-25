import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tech-inject/ui';
import { LoginForm } from '@/components/login-form';
import { hasAdminSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps): Promise<React.JSX.Element> {
  const { next } = await searchParams;

  if (await hasAdminSession()) {
    redirect(next && next.startsWith('/') ? next : '/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm" accent="primary">
        <CardHeader>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <CardTitle>Admin sign in</CardTitle>
          <CardDescription>Enter the administrator secret to manage the design library.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm nextPath={next && next.startsWith('/') ? next : '/'} />
        </CardContent>
      </Card>
    </main>
  );
}
