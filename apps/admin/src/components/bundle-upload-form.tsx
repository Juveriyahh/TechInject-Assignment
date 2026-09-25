'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FileJson, Upload } from 'lucide-react';
import { componentBundleSchema, formatZodIssues } from '@tech-inject/database/schemas';
import { Badge, Button, FormField, Textarea } from '@tech-inject/ui';

/** Maximum accepted upload size, matching the storage bucket's 5 MB limit. */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const EXAMPLE_BUNDLE = `{
  "slug": "crm-metric-card",
  "name": "CRM Metric Card",
  "description": "Displays key performance indicators with comparative deltas.",
  "category": "Data Display",
  "tier": "FREE",
  "version": "1.0.0",
  "dependencies": { "lucide-react": "^0.300.0" },
  "propsSchema": [
    { "name": "title", "type": "string", "required": true, "default": "Total Revenue" },
    { "name": "value", "type": "string", "required": true, "default": "$45,231" }
  ],
  "files": [
    {
      "filePath": "components/data-metric.tsx",
      "fileType": "SOURCE",
      "content": "export const DataMetric = () => null;"
    }
  ]
}`;

interface Issue {
  path: string;
  message: string;
}

export function BundleUploadForm(): React.JSX.Element {
  const router = useRouter();
  const [raw, setRaw] = React.useState('');
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [issues, setIssues] = React.useState<Issue[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const readFile = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIssues([]);
    setMessage(null);

    if (file.size > MAX_UPLOAD_BYTES) {
      setIssues([{ path: 'file', message: 'File exceeds the 5 MB upload limit' }]);
      return;
    }

    // The file is only ever read as text and validated — never executed.
    const text = await file.text();
    setFileName(file.name);
    setRaw(text);
  };

  /** Client-side pre-flight; the server re-validates with the same schema. */
  const validate = (): boolean => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      setIssues([{ path: '(root)', message: 'Payload is not valid JSON' }]);
      return false;
    }

    const result = componentBundleSchema.safeParse(parsed);
    if (!result.success) {
      setIssues(formatZodIssues(result.error));
      return false;
    }

    setIssues([]);
    return true;
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setMessage(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/components', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: raw
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        issues?: Issue[];
        component?: { id: string; slug: string };
      };

      if (!response.ok) {
        setIssues(body.issues ?? []);
        setMessage(body.error ?? `Upload failed with status ${String(response.status)}`);
        return;
      }

      if (body.component) {
        router.push(`/components/${body.component.id}`);
        router.refresh();
        return;
      }

      setMessage('Draft created.');
    } catch {
      setMessage('Network error — please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField
        htmlFor="bundle-file"
        label="Bundle file"
        hint={fileName ? `Loaded ${fileName}` : 'Choose a .json bundle, or paste the payload below.'}
      >
        <div className="flex items-center gap-3">
          <input
            id="bundle-file"
            type="file"
            accept="application/json,.json"
            onChange={(event) => void readFile(event)}
            className="block w-full cursor-pointer rounded-md border border-input bg-surface text-sm file:mr-3 file:cursor-pointer file:rounded-l-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
          />
        </div>
      </FormField>

      <FormField
        htmlFor="bundle-json"
        label="Bundle JSON"
        hint="Validated against the bundle schema before anything is written to the database."
      >
        <Textarea
          id="bundle-json"
          name="bundle"
          rows={18}
          spellCheck={false}
          required
          value={raw}
          aria-invalid={issues.length > 0}
          onChange={(event) => setRaw(event.target.value)}
          placeholder={EXAMPLE_BUNDLE}
        />
      </FormField>

      {issues.length > 0 ? (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive-subtle p-3">
          <p className="text-sm font-medium text-destructive">Validation failed</p>
          <ul className="mt-1.5 flex flex-col gap-1">
            {issues.map((issue) => (
              <li key={`${issue.path}:${issue.message}`} className="text-xs text-destructive">
                <span className="font-mono">{issue.path}</span> — {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? (
        <p role="status" className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" isLoading={isSubmitting} leadingIcon={<Upload className="h-4 w-4" />}>
          Create draft
        </Button>
        <Button type="button" variant="outline" onClick={() => setRaw(EXAMPLE_BUNDLE)} leadingIcon={<FileJson className="h-4 w-4" />}>
          Insert example
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (validate()) setMessage('Bundle is valid.');
          }}
        >
          Validate only
        </Button>
        <Badge variant="neutral">Always saved as a draft</Badge>
      </div>
    </form>
  );
}
