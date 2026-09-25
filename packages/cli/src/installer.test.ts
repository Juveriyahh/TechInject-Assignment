import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { UnsafePathError, type ComponentSourcePayload } from '@tech-inject/shared';
import { installComponent, selectInstallableFiles } from './installer';
import { buildSourceUrl, fetchComponentSource, RegistryError } from './registry-client';

const payload: ComponentSourcePayload = {
  component: {
    slug: 'crm-metric-card',
    name: 'CRM Metric Card',
    description: 'Displays key performance indicators with comparative deltas.',
    category: 'Data Display',
    tier: 'FREE',
    version: '1.0.0',
    updatedAt: '2026-02-01T00:00:00.000Z'
  },
  propsSchema: [{ name: 'title', type: 'string', required: true, default: 'Total Revenue' }],
  dependencies: { npm: { 'lucide-react': '^0.300.0' }, internal: ['Card'] },
  files: [
    { filePath: 'data-metric.tsx', fileType: 'SOURCE', content: 'export const DataMetric = () => null;\n' },
    { filePath: 'styles/metric.css', fileType: 'STYLE', content: '.metric { color: red; }\n' },
    { filePath: 'fixtures/preview.tsx', fileType: 'PREVIEW_FIXTURE', content: 'export default null;\n' }
  ],
  installCommand: 'npx @tech-inject/cli add crm-metric-card',
  agentPrompt: '# Task: add the `CRM Metric Card` component to my project'
};

let workspace: string;

beforeEach(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'tech-inject-cli-'));
});

afterEach(async () => {
  await fs.rm(workspace, { recursive: true, force: true });
});

describe('installComponent', () => {
  it('writes source and style files into the target directory', async () => {
    const result = await installComponent({ payload, targetDirectory: 'components/ui', cwd: workspace });

    expect(result.targetDirectory).toBe(path.join(workspace, 'components', 'ui'));
    expect(result.files.map((file) => file.outcome)).toEqual(['written', 'written']);

    const written = await fs.readFile(path.join(workspace, 'components/ui/data-metric.tsx'), 'utf8');
    expect(written).toBe('export const DataMetric = () => null;\n');

    const style = await fs.readFile(path.join(workspace, 'components/ui/styles/metric.css'), 'utf8');
    expect(style).toContain('.metric');

    // Fixtures are excluded unless explicitly requested.
    await expect(fs.access(path.join(workspace, 'components/ui/fixtures/preview.tsx'))).rejects.toThrow();
    expect(result.dependencyCommand).toBe('npm install lucide-react@"^0.300.0"');
    expect(result.internalDependencies).toEqual(['Card']);
  });

  it('includes fixtures when asked', async () => {
    await installComponent({ payload, targetDirectory: 'ui', cwd: workspace, includeFixtures: true });
    await expect(fs.access(path.join(workspace, 'ui/fixtures/preview.tsx'))).resolves.toBeUndefined();
  });

  it('never overwrites an existing file by default', async () => {
    const target = path.join(workspace, 'components/ui');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'data-metric.tsx'), 'MY OWN CODE', 'utf8');

    const result = await installComponent({ payload, targetDirectory: 'components/ui', cwd: workspace });

    expect(result.skipped.map((file) => file.filePath)).toEqual(['data-metric.tsx']);
    expect(await fs.readFile(path.join(target, 'data-metric.tsx'), 'utf8')).toBe('MY OWN CODE');
  });

  it('overwrites only with --force', async () => {
    const target = path.join(workspace, 'components/ui');
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, 'data-metric.tsx'), 'MY OWN CODE', 'utf8');

    const result = await installComponent({ payload, targetDirectory: 'components/ui', cwd: workspace, force: true });

    expect(result.skipped).toHaveLength(0);
    expect(await fs.readFile(path.join(target, 'data-metric.tsx'), 'utf8')).toBe(
      'export const DataMetric = () => null;\n'
    );
  });

  it('reports identical content as unchanged when forced', async () => {
    await installComponent({ payload, targetDirectory: 'components/ui', cwd: workspace });
    const second = await installComponent({
      payload,
      targetDirectory: 'components/ui',
      cwd: workspace,
      force: true
    });

    expect(second.files.every((file) => file.outcome === 'unchanged')).toBe(true);
  });

  it('writes nothing in dry-run mode', async () => {
    const result = await installComponent({ payload, targetDirectory: 'components/ui', cwd: workspace, dryRun: true });

    expect(result.files.every((file) => file.outcome === 'written')).toBe(true);
    await expect(fs.access(path.join(workspace, 'components/ui/data-metric.tsx'))).rejects.toThrow();
  });

  it.each([
    '../../etc/passwd',
    '../escape.tsx',
    '/etc/passwd',
    'C:/Windows/evil.tsx',
    'nested/../../../escape.tsx',
    '~/.ssh/authorized_keys'
  ])('rejects the unsafe path %j and writes nothing', async (filePath) => {
    const malicious: ComponentSourcePayload = {
      ...payload,
      files: [{ filePath, fileType: 'SOURCE', content: 'pwned' }]
    };

    await expect(
      installComponent({ payload: malicious, targetDirectory: 'components/ui', cwd: workspace })
    ).rejects.toThrow(UnsafePathError);

    // Not even the target directory is created for a rejected bundle.
    await expect(fs.access(path.join(workspace, 'components'))).rejects.toThrow();
  });

  it('rejects a bundle where a later file is unsafe, leaving earlier files unwritten', async () => {
    const mixed: ComponentSourcePayload = {
      ...payload,
      files: [
        { filePath: 'safe.tsx', fileType: 'SOURCE', content: 'ok' },
        { filePath: '../../pwned.tsx', fileType: 'SOURCE', content: 'pwned' }
      ]
    };

    await expect(installComponent({ payload: mixed, targetDirectory: 'ui', cwd: workspace })).rejects.toThrow(
      UnsafePathError
    );
    await expect(fs.access(path.join(workspace, 'ui/safe.tsx'))).rejects.toThrow();
  });

  it('rejects a target directory outside the project root', async () => {
    await expect(installComponent({ payload, targetDirectory: '../outside', cwd: workspace })).rejects.toThrow(
      UnsafePathError
    );
  });

  it('throws when the payload has no installable files', async () => {
    const fixturesOnly: ComponentSourcePayload = {
      ...payload,
      files: [{ filePath: 'fixtures/preview.tsx', fileType: 'PREVIEW_FIXTURE', content: 'x' }]
    };

    await expect(installComponent({ payload: fixturesOnly, targetDirectory: 'ui', cwd: workspace })).rejects.toThrow(
      /no installable files/u
    );
  });

  it('selects files by type', () => {
    expect(selectInstallableFiles(payload, false).map((file) => file.fileType)).toEqual(['SOURCE', 'STYLE']);
    expect(selectInstallableFiles(payload, true)).toHaveLength(3);
  });
});

describe('registry client', () => {
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  it('builds the source URL and sends the bearer token', async () => {
    expect(buildSourceUrl('https://x.dev/', 'a-b')).toBe('https://x.dev/api/components/a-b/source');

    let seenAuth: string | null = null;
    const result = await fetchComponentSource({
      slug: 'crm-metric-card',
      registryUrl: 'https://x.dev',
      token: 'tok_123',
      fetchImpl: (_url, init) => {
        seenAuth = new Headers(init?.headers).get('authorization');
        return Promise.resolve(json(payload));
      }
    });

    expect(seenAuth).toBe('Bearer tok_123');
    expect(result.component.slug).toBe('crm-metric-card');
  });

  it('surfaces a 403 as an actionable RegistryError', async () => {
    await expect(
      fetchComponentSource({
        slug: 'premium-thing',
        registryUrl: 'https://x.dev',
        fetchImpl: () => Promise.resolve(json({ error: 'Premium required.', code: 'UNAUTHENTICATED' }, 403))
      })
    ).rejects.toThrow(/--token/u);
  });

  it('surfaces a 404 for unpublished or unknown slugs', async () => {
    await expect(
      fetchComponentSource({
        slug: 'draft-thing',
        registryUrl: 'https://x.dev',
        fetchImpl: () => Promise.resolve(json({ error: 'Component not found', code: 'NOT_FOUND' }, 404))
      })
    ).rejects.toThrow(/not found or is not published/u);
  });

  it('refuses to install a malformed payload', async () => {
    await expect(
      fetchComponentSource({
        slug: 'crm-metric-card',
        registryUrl: 'https://x.dev',
        fetchImpl: () => Promise.resolve(json({ component: { slug: 'x' } }))
      })
    ).rejects.toThrow(RegistryError);
  });

  it('wraps network failures', async () => {
    await expect(
      fetchComponentSource({
        slug: 'crm-metric-card',
        registryUrl: 'https://x.dev',
        fetchImpl: () => Promise.reject(new Error('ECONNREFUSED'))
      })
    ).rejects.toThrow(/Could not reach the registry/u);
  });
});
