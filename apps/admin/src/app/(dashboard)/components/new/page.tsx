import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@tech-inject/ui';
import { BundleUploadForm } from '@/components/bundle-upload-form';
import { PageHeader } from '@/components/page-header';

export const dynamic = 'force-dynamic';

const SCHEMA_SUMMARY: ReadonlyArray<{ field: string; detail: string }> = [
  { field: 'slug', detail: 'lowercase, hyphen-separated, unique' },
  { field: 'name / description / category', detail: 'required metadata' },
  { field: 'tier', detail: 'FREE or PREMIUM' },
  { field: 'version', detail: 'semver, e.g. 1.0.0' },
  { field: 'dependencies', detail: 'npm map, or { npm, internal }' },
  { field: 'propsSchema', detail: 'array of { name, type, required, default }' },
  { field: 'files', detail: 'at least one SOURCE file; relative paths only' }
];

export default function NewComponentPage(): React.JSX.Element {
  return (
    <>
      <PageHeader
        title="Upload component bundle"
        description="Paste or upload a JSON bundle. It is validated, stored privately and left as a draft."
        actions={
          <Link href="/components">
            <Button variant="outline" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardContent>
            <BundleUploadForm />
          </CardContent>
        </Card>

        <Card accent="primary" className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Bundle contract</CardTitle>
            <CardDescription>Every field is enforced at runtime by the shared Zod schema.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-2.5">
              {SCHEMA_SUMMARY.map((entry) => (
                <div key={entry.field} className="flex flex-col">
                  <dt className="font-mono text-xs text-foreground">{entry.field}</dt>
                  <dd className="text-xs text-muted-foreground">{entry.detail}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
