import { beforeEach, describe, expect, it } from 'vitest';
import { componentBundleSchema } from '../schemas';
import { createFakeSupabase, resetFakeIds, type FakeSupabase } from '../testing/fake-supabase';
import { archiveBundle } from '../storage';
import {
  getComponentWithFiles,
  listComponents,
  setComponentPublished,
  summariseComponents,
  upsertComponentDraft
} from './components';
import { listProfiles, summariseProfiles, updateProfile } from './profiles';

const bundle = componentBundleSchema.parse({
  slug: 'crm-metric-card',
  name: 'CRM Metric Card',
  description: 'Displays key performance indicators with comparative deltas.',
  category: 'Data Display',
  tier: 'FREE',
  dependencies: { 'lucide-react': '^0.300.0' },
  propsSchema: [{ name: 'title', type: 'string', required: true }],
  files: [
    { filePath: 'components/data-metric.tsx', fileType: 'SOURCE', content: 'export const A = 1;' },
    { filePath: 'fixtures/preview.tsx', fileType: 'PREVIEW_FIXTURE', content: 'export default null;' }
  ]
});

let fake: FakeSupabase;

beforeEach(() => {
  resetFakeIds();
  fake = createFakeSupabase({
    profiles: [
      {
        id: 'p-free',
        email: 'free@example.com',
        role: 'CUSTOMER',
        is_premium: false,
        created_at: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'p-premium',
        email: 'premium@example.com',
        role: 'CUSTOMER',
        is_premium: true,
        created_at: '2026-01-02T00:00:00.000Z'
      }
    ]
  });
});

describe('component publishing lifecycle', () => {
  it('creates uploads as unpublished drafts with their files', async () => {
    const created = await upsertComponentDraft(bundle, { client: fake.client });

    expect(created.is_published).toBe(false);
    expect(created.files).toHaveLength(2);
    expect(fake.tables.components).toHaveLength(1);
    expect(fake.tables.component_files).toHaveLength(2);
  });

  it('publishes and then unpublishes, persisting both transitions', async () => {
    const created = await upsertComponentDraft(bundle, { client: fake.client });

    const published = await setComponentPublished(created.id, true, { client: fake.client });
    expect(published?.is_published).toBe(true);
    expect(fake.tables.components[0]?.is_published).toBe(true);

    const unpublished = await setComponentPublished(created.id, false, { client: fake.client });
    expect(unpublished?.is_published).toBe(false);
    expect(fake.tables.components[0]?.is_published).toBe(false);
  });

  it('returns null when publishing an unknown component', async () => {
    const result = await setComponentPublished('00000000-0000-4000-8000-999999999999', true, { client: fake.client });
    expect(result).toBeNull();
  });

  it('replaces the file set on re-upload and resets the component to draft', async () => {
    const created = await upsertComponentDraft(bundle, { client: fake.client });
    await setComponentPublished(created.id, true, { client: fake.client });

    const reuploaded = await upsertComponentDraft(
      componentBundleSchema.parse({
        ...bundle,
        version: '1.1.0',
        files: [{ filePath: 'components/data-metric.tsx', fileType: 'SOURCE', content: 'export const A = 2;' }]
      }),
      { client: fake.client }
    );

    expect(fake.tables.components).toHaveLength(1);
    expect(reuploaded.version).toBe('1.1.0');
    expect(reuploaded.is_published).toBe(false);
    expect(fake.tables.component_files).toHaveLength(1);
    expect(fake.tables.component_files[0]?.content).toBe('export const A = 2;');
  });

  it('loads a component with its files and summarises the catalogue', async () => {
    const created = await upsertComponentDraft(bundle, { client: fake.client });
    const loaded = await getComponentWithFiles(created.id, { client: fake.client });

    expect(loaded?.slug).toBe('crm-metric-card');
    expect(loaded?.files.map((file) => file.file_path)).toEqual([
      'components/data-metric.tsx',
      'fixtures/preview.tsx'
    ]);

    const all = await listComponents({ client: fake.client });
    expect(summariseComponents(all)).toEqual({ total: 1, published: 0, drafts: 1, premium: 0 });
  });
});

describe('customer access management', () => {
  it('grants premium access and persists the change', async () => {
    const updated = await updateProfile('p-free', { isPremium: true }, { client: fake.client });

    expect(updated?.is_premium).toBe(true);
    expect(fake.tables.profiles.find((row) => row.id === 'p-free')?.is_premium).toBe(true);
  });

  it('revokes premium access and persists the change', async () => {
    const updated = await updateProfile('p-premium', { isPremium: false }, { client: fake.client });

    expect(updated?.is_premium).toBe(false);
    expect(fake.tables.profiles.find((row) => row.id === 'p-premium')?.is_premium).toBe(false);
  });

  it('leaves other profiles untouched', async () => {
    await updateProfile('p-free', { isPremium: true }, { client: fake.client });
    expect(fake.tables.profiles.find((row) => row.id === 'p-premium')?.is_premium).toBe(true);
  });

  it('returns null for an unknown profile id', async () => {
    expect(await updateProfile('missing', { isPremium: true }, { client: fake.client })).toBeNull();
  });

  it('summarises the customer base', async () => {
    const profiles = await listProfiles({ client: fake.client });
    expect(summariseProfiles(profiles)).toEqual({ total: 2, premium: 1, free: 1, admins: 0 });
  });
});

describe('bundle archival', () => {
  it('writes the raw bundle to the private bucket', async () => {
    const result = await archiveBundle(bundle, { client: fake.client, bucket: 'component-bundles' });

    expect(result).toEqual({ bucket: 'component-bundles', objectPath: 'crm-metric-card/1.0.0/bundle.json' });
    expect(fake.uploads).toHaveLength(1);
    expect(JSON.parse(fake.uploads[0]?.body ?? '{}')).toMatchObject({ slug: 'crm-metric-card' });
  });
});
