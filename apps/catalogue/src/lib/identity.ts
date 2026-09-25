import { createClient } from '@supabase/supabase-js';
import { getCataloguePublicEnv } from './env';

/**
 * Identity verification, kept behind a narrow interface so the access-control
 * tests can exercise the real route handlers without a live Supabase Auth
 * service. Production always uses `supabaseIdentityProvider`.
 */
export interface VerifiedIdentity {
  userId: string;
  email: string;
}

export interface IdentityProvider {
  /** Resolves the identity behind an access token, or `null` when invalid. */
  verifyAccessToken(token: string): Promise<VerifiedIdentity | null>;
  /** Exchanges credentials for an access token. */
  signIn(
    email: string,
    password: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; email: string } | null>;
}

export const supabaseIdentityProvider: IdentityProvider = {
  async verifyAccessToken(token) {
    const env = getCataloguePublicEnv();
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user?.email) return null;
    return { userId: data.user.id, email: data.user.email };
  },

  async signIn(email, password) {
    const env = getCataloguePublicEnv();
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user?.email) return null;

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      email: data.user.email
    };
  }
};

let provider: IdentityProvider = supabaseIdentityProvider;

export function getIdentityProvider(): IdentityProvider {
  return provider;
}

/** Test-only seam. Pass `null` to restore the Supabase-backed provider. */
export function setIdentityProvider(next: IdentityProvider | null): void {
  provider = next ?? supabaseIdentityProvider;
}
