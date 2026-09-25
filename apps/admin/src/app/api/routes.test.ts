import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeSupabase, resetFakeIds, type FakeSupabase } from '@tech-inject/database/testing';
import { createSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';
import { resetAdminEnvCache } from '@/lib/env';
import { setTestSupabaseClient } from '@/lib/repositories';
import { resetRateLimits } from '@/lib/rate-limit';
import { GET as listComponentsRoute, POST as createComponentRoute } from './components/route';
import { DELETE as deleteComponentRoute, GET as getComponentRoute } from './components/[id]/route';
import { POST as publishRoute } from './publish/route';
import { PATCH as patchUserRoute } from './users/[id]/route';
import { POST as loginRoute } from './auth/login/route';

const ADMIN_SECRET = 'integration-test-admin-secret';
const FREE_ID = '11111111-1111-4111-8111-111111111111';
const PREMIUM_ID = '22222222-2222-4222-8222-222222222222';

const validBundle = {
  slug: 'crm-metric-card',
  name: 'CRM Metric Card',
  description: 'Displays key performance indicators with comparative deltas.',
  category: 'Data Display',
  tier: 'FREE',
  version: '1.0.0',
  dependencies: { 'lucide-react': '^0.300.0' },
  propsSchema: [{ name: 'title', type: 'string', required: true, default: 'Total Revenue' }],
  files: [
    { filePath: 'components/data-metric.tsx', fileType: 'SOURCE', content: 'export const A = 1;' },
    { filePath: 'fixtures/preview.tsx', fileType: 'PREVIEW_FIXTURE', content: 'export default null;' }
  ]
};

let fake: FakeSupabase;

/** Builds a request that carries valid admin credentials. */
function authed(path: string, init: RequestInit = {}, mode: 'header' | 'cookie' = 'header'): Request {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (mode === 'header') headers.set('x-admin-secret', ADMIN_SECRET);
  else headers.set('cookie', `${SESSION_COOKIE_NAME}=${createSessionToken()}`);
  return new Request(`http://admin.test${path}`, { ...init, headers });
}

function anonymous(path: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  return new Request(`http://admin.test${path}`, { ...init, headers });
}

const ctx = (id: string): { params: Promise<{ id: string }> } => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  process.env.ADMIN_SECRET = ADMIN_SECRET;
  process.env.SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-tests-0123456789';
  process.env.SUPABASE_STORAGE_BUCKET = 'component-bundles';
  resetAdminEnvCache();
  resetRateLimits();
  resetFakeIds();

  fake = createFakeSupabase({
    profiles: [
      {
        id: FREE_ID,
        email: 'free@example.com',
        role: 'CUSTOMER',
        is_premium: false,
        created_at: '2026-01-01T00:00:00.000Z'
      },
      {
        id: PREMIUM_ID,
        email: 'premium@example.com',
        role: 'CUSTOMER',
        is_premium: true,
        created_at: '2026-01-02T00:00:00.000Z'
      }
    ]
  });
  setTestSupabaseClient(fake.client);
});

describe('admin API authentication', () => {
  it('rejects unauthenticated writes to every admin endpoint with 401', async () => {
    const responses = await Promise.all([
      createComponentRoute(anonymous('/api/components', { method: 'POST', body: JSON.stringify(validBundle) }), {}),
      listComponentsRoute(anonymous('/api/components'), {}),
      publishRoute(
        anonymous('/api/publish', { method: 'POST', body: JSON.stringify({ componentId: FREE_ID, isPublished: true }) }),
        {}
      ),
      patchUserRoute(
        anonymous(`/api/users/${FREE_ID}`, { method: 'PATCH', body: JSON.stringify({ isPremium: true }) }),
        ctx(FREE_ID)
      )
    ]);

    for (const response of responses) {
      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    }
    // Nothing was written.
    expect(fake.tables.components).toHaveLength(0);
    expect(fake.tables.profiles.find((row) => row.id === FREE_ID)?.is_premium).toBe(false);
  });

  it('rejects an invalid admin secret', async () => {
    const request = new Request('http://admin.test/api/components', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-secret': 'not-the-secret' },
      body: JSON.stringify(validBundle)
    });

    const response = await createComponentRoute(request, {});
    expect(response.status).toBe(401);
    expect(fake.tables.components).toHaveLength(0);
  });

  it('rejects a forged session cookie', async () => {
    const request = new Request('http://admin.test/api/publish', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `${SESSION_COOKIE_NAME}=forged.token` },
      body: JSON.stringify({ componentId: FREE_ID, isPublished: true })
    });

    expect((await publishRoute(request, {})).status).toBe(401);
  });

  it('accepts a valid session cookie', async () => {
    const response = await listComponentsRoute(authed('/api/components', {}, 'cookie'), {});
    expect(response.status).toBe(200);
  });
});

describe('POST /api/auth/login', () => {
  it('sets an HttpOnly session cookie for the correct secret', async () => {
    const response = await loginRoute(
      anonymous('/api/auth/login', { method: 'POST', body: JSON.stringify({ secret: ADMIN_SECRET }) })
    );

    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(SESSION_COOKIE_NAME);
    expect(cookie).toContain('HttpOnly');
  });

  it('rejects the wrong secret without setting a cookie', async () => {
    const response = await loginRoute(
      anonymous('/api/auth/login', { method: 'POST', body: JSON.stringify({ secret: 'nope' }) })
    );

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects a malformed login body', async () => {
    const response = await loginRoute(anonymous('/api/auth/login', { method: 'POST', body: '{ not json' }));
    expect(response.status).toBe(400);
  });

  it('throttles repeated attempts', async () => {
    const attempt = (): Promise<Response> =>
      loginRoute(
        new Request('http://admin.test/api/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
          body: JSON.stringify({ secret: 'nope' })
        })
      );

    const statuses: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      statuses.push((await attempt()).status);
    }

    expect(statuses.filter((status) => status === 429).length).toBeGreaterThan(0);
  });
});

describe('POST /api/components', () => {
  it('creates a draft with is_published = false', async () => {
    const response = await createComponentRoute(
      authed('/api/components', { method: 'POST', body: JSON.stringify(validBundle) }),
      {}
    );

    expect(response.status).toBe(201);
    const body = (await response.json()) as { component: { id: string; is_published: boolean } };
    expect(body.component.is_published).toBe(false);
    expect(fake.tables.components).toHaveLength(1);
    expect(fake.tables.component_files).toHaveLength(2);
    // The raw bundle is archived in the private bucket.
    expect(fake.uploads[0]?.bucket).toBe('component-bundles');
  });

  it.each([
    ['missing required fields', { slug: 'only-slug' }],
    ['invalid slug', { ...validBundle, slug: 'Invalid Slug' }],
    ['invalid tier', { ...validBundle, tier: 'ENTERPRISE' }],
    ['invalid version', { ...validBundle, version: 'v1' }],
    ['no files', { ...validBundle, files: [] }],
    ['traversing file path', { ...validBundle, files: [{ ...validBundle.files[0], filePath: '../../etc/passwd' }] }],
    ['caller-supplied publication flag', { ...validBundle, is_published: true }]
  ])('rejects %s with 422 and writes nothing', async (_label, payload) => {
    const response = await createComponentRoute(
      authed('/api/components', { method: 'POST', body: JSON.stringify(payload) }),
      {}
    );

    expect(response.status).toBe(422);
    const body = (await response.json()) as { error: string; issues: unknown[] };
    expect(body.error).toBe('Validation failed');
    expect(body.issues.length).toBeGreaterThan(0);
    expect(fake.tables.components).toHaveLength(0);
  });

  it('rejects a body that is not JSON with 400', async () => {
    const response = await createComponentRoute(authed('/api/components', { method: 'POST', body: 'nope' }), {});
    expect(response.status).toBe(400);
  });
});

describe('POST /api/publish', () => {
  async function createDraft(): Promise<string> {
    const response = await createComponentRoute(
      authed('/api/components', { method: 'POST', body: JSON.stringify(validBundle) }),
      {}
    );
    const body = (await response.json()) as { component: { id: string } };
    return body.component.id;
  }

  it('publishes then unpublishes, persisting both states', async () => {
    const id = await createDraft();

    const published = await publishRoute(
      authed('/api/publish', { method: 'POST', body: JSON.stringify({ componentId: id, isPublished: true }) }),
      {}
    );
    expect(published.status).toBe(200);
    expect(fake.tables.components[0]?.is_published).toBe(true);

    const unpublished = await publishRoute(
      authed('/api/publish', { method: 'POST', body: JSON.stringify({ componentId: id, isPublished: false }) }),
      {}
    );
    expect(unpublished.status).toBe(200);
    const body = (await unpublished.json()) as { component: { is_published: boolean } };
    expect(body.component.is_published).toBe(false);
    expect(fake.tables.components[0]?.is_published).toBe(false);
  });

  it('returns 404 for an unknown component', async () => {
    const response = await publishRoute(
      authed('/api/publish', {
        method: 'POST',
        body: JSON.stringify({ componentId: '99999999-9999-4999-8999-999999999999', isPublished: true })
      }),
      {}
    );
    expect(response.status).toBe(404);
  });

  it('rejects a malformed publish payload', async () => {
    const response = await publishRoute(
      authed('/api/publish', { method: 'POST', body: JSON.stringify({ componentId: 'not-a-uuid', isPublished: 'yes' }) }),
      {}
    );
    expect(response.status).toBe(422);
  });

  it('exposes the draft to admins and deletes it with its files', async () => {
    const id = await createDraft();

    const detail = await getComponentRoute(authed(`/api/components/${id}`), ctx(id));
    expect(detail.status).toBe(200);
    const body = (await detail.json()) as { component: { files: unknown[] } };
    expect(body.component.files).toHaveLength(2);

    const deleted = await deleteComponentRoute(authed(`/api/components/${id}`, { method: 'DELETE' }), ctx(id));
    expect(deleted.status).toBe(200);
    expect(fake.tables.components).toHaveLength(0);
    expect(fake.tables.component_files).toHaveLength(0);
  });
});

describe('PATCH /api/users/[id]', () => {
  it('grants premium access and persists it', async () => {
    const response = await patchUserRoute(
      authed(`/api/users/${FREE_ID}`, { method: 'PATCH', body: JSON.stringify({ isPremium: true }) }),
      ctx(FREE_ID)
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { profile: { is_premium: boolean; email: string } };
    expect(body.profile).toMatchObject({ email: 'free@example.com', is_premium: true });
    expect(fake.tables.profiles.find((row) => row.id === FREE_ID)?.is_premium).toBe(true);
  });

  it('revokes premium access and persists it', async () => {
    const response = await patchUserRoute(
      authed(`/api/users/${PREMIUM_ID}`, { method: 'PATCH', body: JSON.stringify({ isPremium: false }) }),
      ctx(PREMIUM_ID)
    );

    expect(response.status).toBe(200);
    expect(fake.tables.profiles.find((row) => row.id === PREMIUM_ID)?.is_premium).toBe(false);
  });

  it('rejects an unknown field', async () => {
    const response = await patchUserRoute(
      authed(`/api/users/${FREE_ID}`, { method: 'PATCH', body: JSON.stringify({ email: 'attacker@example.com' }) }),
      ctx(FREE_ID)
    );

    expect(response.status).toBe(422);
    expect(fake.tables.profiles.find((row) => row.id === FREE_ID)?.email).toBe('free@example.com');
  });

  it('rejects a non-UUID id', async () => {
    const response = await patchUserRoute(
      authed('/api/users/abc', { method: 'PATCH', body: JSON.stringify({ isPremium: true }) }),
      ctx('abc')
    );
    expect(response.status).toBe(422);
  });

  it('returns 404 for a missing customer', async () => {
    const missing = '33333333-3333-4333-8333-333333333333';
    const response = await patchUserRoute(
      authed(`/api/users/${missing}`, { method: 'PATCH', body: JSON.stringify({ isPremium: true }) }),
      ctx(missing)
    );
    expect(response.status).toBe(404);
  });
});
