import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, getServiceRoleClient } from '../client';
import type { ProfileUpdateInput } from '../schemas';
import type { ProfileRow } from '../types';

const PROFILE_COLUMNS = 'id, email, role, is_premium, created_at';

export interface ProfileRepositoryDeps {
  client?: SupabaseClient;
}

function resolveClient(deps?: ProfileRepositoryDeps): SupabaseClient {
  return deps?.client ?? getServiceRoleClient();
}

/** All customer accounts, newest last so the seeded demo users stay stable. */
export async function listProfiles(deps?: ProfileRepositoryDeps): Promise<ProfileRow[]> {
  const { data, error } = await resolveClient(deps)
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .order('created_at', { ascending: true });

  if (error) throw new DatabaseError('listProfiles', error);
  return (data ?? []) as ProfileRow[];
}

export async function getProfile(profileId: string, deps?: ProfileRepositoryDeps): Promise<ProfileRow | null> {
  const { data, error } = await resolveClient(deps)
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw new DatabaseError('getProfile', error);
  return (data as ProfileRow | null) ?? null;
}

/** Grants or revokes premium access (and optionally changes the role). */
export async function updateProfile(
  profileId: string,
  update: ProfileUpdateInput,
  deps?: ProfileRepositoryDeps
): Promise<ProfileRow | null> {
  const patch: Record<string, unknown> = {};
  if (update.isPremium !== undefined) patch.is_premium = update.isPremium;
  if (update.role !== undefined) patch.role = update.role;

  const { data, error } = await resolveClient(deps)
    .from('profiles')
    .update(patch)
    .eq('id', profileId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) throw new DatabaseError('updateProfile', error);
  return (data as ProfileRow | null) ?? null;
}

export interface ProfileStats {
  total: number;
  premium: number;
  free: number;
  admins: number;
}

export function summariseProfiles(profiles: ReadonlyArray<ProfileRow>): ProfileStats {
  return profiles.reduce<ProfileStats>(
    (stats, profile) => ({
      total: stats.total + 1,
      premium: stats.premium + (profile.is_premium ? 1 : 0),
      free: stats.free + (profile.is_premium ? 0 : 1),
      admins: stats.admins + (profile.role === 'ADMIN' ? 1 : 0)
    }),
    { total: 0, premium: 0, free: 0, admins: 0 }
  );
}
