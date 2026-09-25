import Link from 'next/link';
import { ArrowRight, Bot, Crown, Terminal } from 'lucide-react';
import { groupByCategory, listPublishedComponents } from '@tech-inject/database';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tech-inject/ui';
import { CodeBlock } from '@/components/code-block';
import { repositoryDeps } from '@/lib/repositories';
import { getServerViewer } from '@/lib/server-viewer';

export const dynamic = 'force-dynamic';

const GLOBAL_SETUP_CSS = `/* app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 210 40% 98%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --primary: 239 84% 60%;
  --primary-foreground: 210 40% 98%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 226 100% 97%;
  --accent-foreground: 239 84% 45%;
  --success: 142 71% 40%;
  --warning: 38 92% 50%;
  --destructive: 0 72% 51%;
  --border: 214 32% 91%;
  --input: 214 32% 91%;
  --ring: 239 84% 60%;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}`;

const TAILWIND_SETUP = `// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
        },
        border: 'hsl(var(--border) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)'
      },
      borderRadius: { md: 'var(--radius-md)', lg: 'var(--radius-lg)' }
    }
  }
} satisfies Config;`;

export default async function GetStartedPage(): Promise<React.JSX.Element> {
  const [components, viewer] = await Promise.all([listPublishedComponents(repositoryDeps()), getServerViewer()]);
  const groups = groupByCategory(components);

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <section className="flex flex-col gap-3">
        <Badge variant="brand">Tech Inject Design Library</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">
          Production-ready CRM components for your Next.js app
        </h1>
        <p className="text-sm text-muted-foreground">
          Copy the source, run one CLI command, or hand a generated prompt to your coding agent. Every component is
          typed, token-driven and works in light and dark mode.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {components[0] ? (
            <Link href={`/components/${components[0].slug}`}>
              <Button trailingIcon={<ArrowRight className="h-4 w-4" />}>Browse components</Button>
            </Link>
          ) : null}
          {viewer.isAuthenticated ? (
            <Link href="/account">
              <Button variant="outline">Your plan</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="outline">Sign in</Button>
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Terminal, title: 'CLI installer', body: 'npx @tech-inject/cli add <slug> writes the files for you.' },
          { icon: Bot, title: 'Agent prompts', body: 'A tailored prompt per component, with the theme contract.' },
          { icon: Crown, title: 'Premium tier', body: 'Premium sources are gated server-side, not just in the UI.' }
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <item.icon className="h-4 w-4" />
              </span>
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.body}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Prerequisites</h2>
        <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
          <li>· Next.js 14 or 15 with the App Router, React 18 or 19</li>
          <li>· TypeScript 5 (strict mode recommended)</li>
          <li>· Tailwind CSS 3.4+ with a PostCSS pipeline</li>
          <li>
            · <code className="font-mono text-foreground">clsx</code>,{' '}
            <code className="font-mono text-foreground">tailwind-merge</code> and{' '}
            <code className="font-mono text-foreground">lucide-react</code> for the shared helpers and icons
          </li>
          <li>· Node.js 20+ to run the installer</li>
        </ul>
        <CodeBlock title="Install the shared peers" code={'npm install clsx tailwind-merge lucide-react'} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">1. Add the design tokens</h2>
        <p className="text-sm text-muted-foreground">
          Every component styles itself through CSS variables. Paste these into your global stylesheet — the values are
          HSL channel triples, so Tailwind can apply opacity modifiers.
        </p>
        <CodeBlock title="app/globals.css" code={GLOBAL_SETUP_CSS} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">2. Map the tokens in Tailwind</h2>
        <CodeBlock title="tailwind.config.ts" code={TAILWIND_SETUP} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">3. Add a component</h2>
        <CodeBlock title="Terminal" code={'npx @tech-inject/cli add crm-metric-card'} />
        <p className="text-sm text-muted-foreground">
          Premium components additionally need your access token:{' '}
          <code className="font-mono text-foreground">--token &lt;token&gt;</code>. Copy yours from the{' '}
          <Link href="/account" className="text-primary hover:underline">
            account page
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Catalogue</h2>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No components have been published yet. Publish one from the admin dashboard to see it here.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {groups.map((group) => (
              <div key={group.category} className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.category}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.components.map((component) => (
                    <Link key={component.slug} href={`/components/${component.slug}`} className="group">
                      <Card className="h-full transition-shadow group-hover:shadow-popover">
                        <CardContent className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{component.name}</span>
                            <Badge variant={component.tier === 'PREMIUM' ? 'brand' : 'neutral'}>
                              {component.tier}
                            </Badge>
                          </div>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{component.description}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
