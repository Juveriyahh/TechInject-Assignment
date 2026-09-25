import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeSupabase, resetFakeIds, type FakeSupabase } from '@tech-inject/database/testing';
import { componentSourcePayloadSchema } from '@tech-inject/shared';
import { setIdentityProvider, type IdentityProvider } from '@/lib/identity';
import { setTestSupabaseClient } from '@/lib/repositories';
import { SESSION_COOKIE_NAME } from '@/lib/viewer';
import { GET as listComponentsRoute } from './components/route';
import { GET as sourceRoute } from './components/[slug]/source/route';
import { GET as meRoute } from './me/route';
import { POST as loginRoute } from './auth/login/route';

const FREE_TOKEN = 'token-free-user';
const PREMIUM_TOKEN = 'token-premium-user';

/** Deterministic identity provider standing in for Supabase Auth. */
const identityProvider: IdentityProvider = {
  verifyAccessToken: (token) => {
    if (token === FREE_TOKEN) return Promise.resolve({ userId: 'u-free', email: 'free@example.com' });
    if (token === PREMIUM_TOKEN) return Promise.resolve({ userId: 'u-premium', email: 'premium@example.com' });
    return Promise.resolve(null);
  },
  signIn: (email, password) =>
    password === 'correct-password' && (email === 'free@example.com' || email === 'premium@example.com')
      ? Promise.resolve({
          accessToken: email === 'premium@example.com' ? PREMIUM_TOKEN : FREE_TOKEN,
          refreshToken: 'refresh',
          expiresIn: 3600,
          email
        })
      : Promise.resolve(null)
};

function component(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: `c-${String(overrides.slug)}`,
    slug: 'free-component',
    name: 'Free Component',
    description: 'A published free component.',
    category: 'Data Display',
    tier: 'FREE',
    is_published: true,
    version: '1.0.0',
    props_schema: [{ name: 'title', type: 'string', required: true, default: 'Total Revenue' }],
    dependencies: { npm: { 'lucide-react': '^0.300.0' }, internal: ['Card'] },
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-02-01T00:00:00.000Z',
    ...overrides
  };
}

const SECRET_SOURCE = 'export const PremiumSecret = () => null;';

let fake: FakeSupabase;

const request = (path: string, headers: Record<string, string> = {}): Request =>
  new Request(`http://catalogue.test${path}`, { headers });

const ctx = (slug: string): { params: Promise<{ slug: string }> } => ({ params: Promise.resolve({ slug }) });

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-for-tests-0123456789';
  resetFakeIds();
  setIdentityProvider(identityProvider);

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
    ],
    components: [
      component({ slug: 'free-component' }),
      component({ slug: 'premium-component', name: 'Premium Component', tier: 'PREMIUM' }),
      component({ slug: 'draft-component', name: 'Draft Component', is_published: false }),
      component({ slug: 'draft-premium', name: 'Draft Premium', tier: 'PREMIUM', is_published: false })
    ],
    component_files: [
      {
        id: 'f-1',
        component_id: 'c-free-component',
        file_path: 'components/free.tsx',
        content: 'export const Free = () => null;',
        file_type: 'SOURCE',
        created_at: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'f-2',
        component_id: 'c-premium-component',
        file_path: 'components/premium.tsx',
        content: SECRET_SOURCE,
        file_type: 'SOURCE',
        created_at: '2026-01-01T00:00:00.000Z'
      },
      {
        id: 'f-3',
        component_id: 'c-draft-component',
        file_path: 'components/draft.tsx',
        content: 'export const Draft = () => null;',
        file_type: 'SOURCE',
        created_at: '2026-01-01T00:00:00.000Z'
      }
    ]
  });
  setTestSupabaseClient(fake.client);
});

describe('GET /api/components/[slug]/source — free components', () => {
  it('returns 200 with the source for anonymous callers', async () => {
    const response = await sourceRoute(request('/api/components/free-component/source'), ctx('free-component'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');

    const payload = componentSourcePayloadSchema.parse(await response.json());
    expect(payload.component.tier).toBe('FREE');
    expect(payload.files[0]?.content).toBe('export const Free = () => null;');
    expect(payload.installCommand).toBe('npx @tech-inject/cli add free-component');
    expect(payload.agentPrompt).toContain('# Task: add the `Free Component` component to my project');
  });

  it('returns 200 for a signed-in free user', async () => {
    const response = await sourceRoute(
      request('/api/components/free-component/source', { cookie: `${SESSION_COOKIE_NAME}=${FREE_TOKEN}` }),
      ctx('free-component')
    );
    expect(response.status).toBe(200);
  });
});

describe('GET /api/components/[slug]/source — premium enforcement', () => {
  it('returns 403 and no source for anonymous callers', async () => {
    const response = await sourceRoute(request('/api/components/premium-component/source'), ctx('premium-component'));
    const body = await response.text();

    expect(response.status).toBe(403);
    expect(body).not.toContain(SECRET_SOURCE);
    expect(JSON.parse(body)).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('returns 403 and no source for an authenticated FREE user', async () => {
    const response = await sourceRoute(
      request('/api/components/premium-component/source', { cookie: `${SESSION_COOKIE_NAME}=${FREE_TOKEN}` }),
      ctx('premium-component')
    );
    const body = await response.text();

    expect(response.status).toBe(403);
    expect(body).not.toContain(SECRET_SOURCE);
    expect(JSON.parse(body)).toMatchObject({ code: 'PREMIUM_REQUIRED' });
  });

  it('returns 403 for an invalid or expired token', async () => {
    const response = await sourceRoute(
      request('/api/components/premium-component/source', { authorization: 'Bearer forged-token' }),
      ctx('premium-component')
    );

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain(SECRET_SOURCE);
  });

  it('returns 200 with the source for a premium user via cookie', async () => {
    const response = await sourceRoute(
      request('/api/components/premium-component/source', { cookie: `${SESSION_COOKIE_NAME}=${PREMIUM_TOKEN}` }),
      ctx('premium-component')
    );

    expect(response.status).toBe(200);
    const payload = componentSourcePayloadSchema.parse(await response.json());
    expect(payload.files[0]?.content).toBe(SECRET_SOURCE);
    expect(payload.installCommand).toContain('--token');
  });

  it('returns 200 with the source for a premium user via bearer token (CLI path)', async () => {
    const response = await sourceRoute(
      request('/api/components/premium-component/source', { authorization: `Bearer ${PREMIUM_TOKEN}` }),
      ctx('premium-component')
    );

    expect(response.status).toBe(200);
  });

  it('revoking premium access blocks the next request immediately', async () => {
    const authed = (): Promise<Response> =>
      sourceRoute(
        request('/api/components/premium-component/source', { authorization: `Bearer ${PREMIUM_TOKEN}` }),
        ctx('premium-component')
      );

    expect((await authed()).status).toBe(200);

    // The admin dashboard revokes premium; the token itself is unchanged.
    const profile = fake.tables.profiles.find((row) => row.email === 'premium@example.com');
    if (profile) profile.is_premium = false;

    const afterRevocation = await authed();
    expect(afterRevocation.status).toBe(403);
    expect(await afterRevocation.text()).not.toContain(SECRET_SOURCE);

    // Re-granting restores access on the next call, with no re-login.
    if (profile) profile.is_premium = true;
    expect((await authed()).status).toBe(200);
  });

  it('treats a signed-in user with no profile row as free', async () => {
    fake.tables.profiles.splice(0, fake.tables.profiles.length);

    const response = await sourceRoute(
      request('/api/components/premium-component/source', { authorization: `Bearer ${PREMIUM_TOKEN}` }),
      ctx('premium-component')
    );

    expect(response.status).toBe(403);
  });
});

describe('data isolation — unpublished components', () => {
  it.each(['draft-component', 'draft-premium'])('returns 404 for the unpublished slug %s', async (slug) => {
    const headerVariants: Array<Record<string, string>> = [{}, { authorization: `Bearer ${PREMIUM_TOKEN}` }];
    for (const headers of headerVariants) {
      const response = await sourceRoute(request(`/api/components/${slug}/source`, headers), ctx(slug));
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain('export const Draft');
    }
  });

  it('returns 404 for an unknown slug and for a malformed slug', async () => {
    expect((await sourceRoute(request('/api/components/nope/source'), ctx('nope'))).status).toBe(404);
    expect((await sourceRoute(request('/api/components/Bad_Slug/source'), ctx('Bad_Slug'))).status).toBe(404);
  });

  it('omits unpublished components from the public list', async () => {
    const response = await listComponentsRoute();
    const body = (await response.json()) as { components: Array<{ slug: string }> };

    expect(response.status).toBe(200);
    expect(body.components.map((entry) => entry.slug).sort()).toEqual(['free-component', 'premium-component']);
  });

  it('never includes file contents in the public list', async () => {
    const body = await (await listComponentsRoute()).text();
    expect(body).not.toContain(SECRET_SOURCE);
    expect(body).not.toContain('export const Free');
  });
});

describe('GET /api/me', () => {
  it('reports the anonymous, free and premium cases', async () => {
    const anonymous = (await (await meRoute(request('/api/me'))).json()) as Record<string, unknown>;
    expect(anonymous).toMatchObject({ isAuthenticated: false, plan: 'FREE' });

    const free = (await (
      await meRoute(request('/api/me', { authorization: `Bearer ${FREE_TOKEN}` }))
    ).json()) as Record<string, unknown>;
    expect(free).toMatchObject({ isAuthenticated: true, email: 'free@example.com', plan: 'FREE' });

    const premium = (await (
      await meRoute(request('/api/me', { authorization: `Bearer ${PREMIUM_TOKEN}` }))
    ).json()) as Record<string, unknown>;
    expect(premium).toMatchObject({ isAuthenticated: true, email: 'premium@example.com', plan: 'PREMIUM' });
  });
});

describe('POST /api/auth/login', () => {
  const post = (body: unknown): Request =>
    new Request('http://catalogue.test/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });

  it('sets an HttpOnly cookie and reports the plan', async () => {
    const response = await loginRoute(post({ email: 'premium@example.com', password: 'correct-password' }));

    expect(response.status).toBe(200);
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain(SESSION_COOKIE_NAME);
    expect(cookie).toContain('HttpOnly');
    expect(await response.json()).toMatchObject({ email: 'premium@example.com', plan: 'PREMIUM' });
  });

  it('rejects bad credentials without setting a cookie', async () => {
    const response = await loginRoute(post({ email: 'free@example.com', password: 'wrong-password' }));

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('rejects malformed bodies', async () => {
    expect((await loginRoute(post({ email: 'not-an-email', password: 'correct-password' }))).status).toBe(400);
    expect((await loginRoute(post({ email: 'free@example.com' }))).status).toBe(400);
    // Too-short passwords are rejected by the schema before any auth call.
    expect((await loginRoute(post({ email: 'free@example.com', password: 'short' }))).status).toBe(400);
    expect((await loginRoute(post('{ not json'))).status).toBe(400);
    expect((await loginRoute(post({ email: 'free@example.com', password: 'correct-password', admin: true }))).status).toBe(
      400
    );
  });
});
