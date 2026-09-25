import { describe, expect, it } from 'vitest';
import { componentBundleSchema, normaliseDependencies, parseComponentBundleJson, profileUpdateSchema } from './schemas';

const validBundle = {
  slug: 'crm-metric-card',
  name: 'CRM Metric Card',
  description: 'Displays key performance indicators with comparative deltas.',
  category: 'Data Display',
  tier: 'FREE',
  version: '1.0.0',
  dependencies: { 'lucide-react': '^0.300.0' },
  propsSchema: [{ name: 'title', type: 'string', required: true, default: 'Total Revenue' }],
  files: [{ filePath: 'components/data-metric.tsx', fileType: 'SOURCE', content: 'export const A = 1;' }]
} as const;

describe('componentBundleSchema', () => {
  it('accepts a well-formed bundle and applies defaults', () => {
    const parsed = componentBundleSchema.parse(validBundle);

    expect(parsed.slug).toBe('crm-metric-card');
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.files[0]?.fileType).toBe('SOURCE');
    expect(normaliseDependencies(parsed.dependencies)).toEqual({
      npm: { 'lucide-react': '^0.300.0' },
      internal: []
    });
  });

  it('accepts the explicit npm/internal dependency shape', () => {
    const parsed = componentBundleSchema.parse({
      ...validBundle,
      dependencies: { npm: { zod: '^3.0.0' }, internal: ['Card'] }
    });

    expect(normaliseDependencies(parsed.dependencies)).toEqual({ npm: { zod: '^3.0.0' }, internal: ['Card'] });
  });

  it.each([
    ['missing name', { ...validBundle, name: undefined }],
    ['missing files', { ...validBundle, files: [] }],
    ['invalid slug casing', { ...validBundle, slug: 'CRM_Metric_Card' }],
    ['invalid slug spacing', { ...validBundle, slug: 'crm metric card' }],
    ['invalid tier', { ...validBundle, tier: 'ENTERPRISE' }],
    ['invalid version', { ...validBundle, version: '1.0' }],
    ['unknown top-level key', { ...validBundle, isPublished: true }],
    ['empty file content', { ...validBundle, files: [{ ...validBundle.files[0], content: '' }] }]
  ])('rejects %s', (_label, payload) => {
    expect(componentBundleSchema.safeParse(payload).success).toBe(false);
  });

  it('rejects absolute and traversing file paths', () => {
    for (const filePath of ['/etc/passwd', '../../secret.tsx', 'C:/windows/system32.tsx', 'a//b.tsx']) {
      const result = componentBundleSchema.safeParse({
        ...validBundle,
        files: [{ filePath, fileType: 'SOURCE', content: 'export const A = 1;' }]
      });
      expect(result.success, filePath).toBe(false);
    }
  });

  it('rejects duplicate file paths and bundles without a SOURCE file', () => {
    const duplicate = componentBundleSchema.safeParse({
      ...validBundle,
      files: [validBundle.files[0], { ...validBundle.files[0], content: 'export const B = 2;' }]
    });
    expect(duplicate.success).toBe(false);

    const noSource = componentBundleSchema.safeParse({
      ...validBundle,
      files: [{ filePath: 'fixtures/preview.tsx', fileType: 'PREVIEW_FIXTURE', content: 'export default null;' }]
    });
    expect(noSource.success).toBe(false);
  });

  it('rejects enum props without options', () => {
    const result = componentBundleSchema.safeParse({
      ...validBundle,
      propsSchema: [{ name: 'trend', type: 'enum', required: false }]
    });
    expect(result.success).toBe(false);
  });

  it('never trusts a caller-supplied publication flag', () => {
    const result = componentBundleSchema.safeParse({ ...validBundle, is_published: true });
    expect(result.success).toBe(false);
  });
});

describe('parseComponentBundleJson', () => {
  it('throws a SyntaxError for malformed JSON', () => {
    expect(() => parseComponentBundleJson('{ not json')).toThrow(SyntaxError);
  });

  it('parses a valid JSON document', () => {
    expect(parseComponentBundleJson(JSON.stringify(validBundle)).slug).toBe('crm-metric-card');
  });
});

describe('profileUpdateSchema', () => {
  it('accepts a premium toggle', () => {
    expect(profileUpdateSchema.parse({ isPremium: true })).toEqual({ isPremium: true });
  });

  it('rejects an empty patch and unknown fields', () => {
    expect(profileUpdateSchema.safeParse({}).success).toBe(false);
    expect(profileUpdateSchema.safeParse({ email: 'hacker@example.com' }).success).toBe(false);
  });
});
