import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, getServiceRoleClient } from '../client';
import type { ComponentFileRow, ComponentRow, ComponentWithFiles, ProfileRow } from '../types';

/**
 * Read paths for the public catalogue.
 *
 * Every function here filters on `is_published = true` in SQL, so an
 * unpublished component is indistinguishable from a non-existent one no matter
 * which client is used. Entitlement (FREE vs PREMIUM) is a separate decision
 * made by the caller — see the catalogue's `/api/components/[slug]/source`
 * route, which never reads file contents until it has cleared that check.
 */
const COMPONENT_COLUMNS =
  'id, slug, name, description, category, tier, is_published, version, props_schema, dependencies, created_at, updated_at';

const FILE_COLUMNS = 'id, component_id, file_path, content, file_type, created_at';

export interface PublicRepositoryDeps {
  client?: SupabaseClient;
}

function resolveClient(deps?: PublicRepositoryDeps): SupabaseClient {
  return deps?.client ?? getServiceRoleClient();
}

/** Published components only, ordered for stable sidebar rendering. */
export async function listPublishedComponents(deps?: PublicRepositoryDeps): Promise<ComponentRow[]> {
  const { data, error } = await resolveClient(deps)
    .from('components')
    .select(COMPONENT_COLUMNS)
    .eq('is_published', true)
    .order('name', { ascending: true });

  if (error) throw new DatabaseError('listPublishedComponents', error);
  return (data ?? []) as ComponentRow[];
}

/** Published metadata for one slug, without touching file contents. */
export async function getPublishedComponentBySlug(
  slug: string,
  deps?: PublicRepositoryDeps
): Promise<ComponentRow | null> {
  const { data, error } = await resolveClient(deps)
    .from('components')
    .select(COMPONENT_COLUMNS)
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error) throw new DatabaseError('getPublishedComponentBySlug', error);
  return (data as ComponentRow | null) ?? null;
}

/**
 * Published component *including* its source files. Only call this once the
 * caller's entitlement has been verified.
 */
export async function getPublishedComponentWithFiles(
  slug: string,
  deps?: PublicRepositoryDeps
): Promise<ComponentWithFiles | null> {
  const component = await getPublishedComponentBySlug(slug, deps);
  if (!component) return null;

  const { data, error } = await resolveClient(deps)
    .from('component_files')
    .select(FILE_COLUMNS)
    .eq('component_id', component.id)
    .order('file_path', { ascending: true });

  if (error) throw new DatabaseError('getPublishedComponentFiles', error);
  return { ...component, files: (data ?? []) as ComponentFileRow[] };
}

/** Looks up a customer by email — the identity carried by a Supabase session. */
export async function getProfileByEmail(email: string, deps?: PublicRepositoryDeps): Promise<ProfileRow | null> {
  const { data, error } = await resolveClient(deps)
    .from('profiles')
    .select('id, email, role, is_premium, created_at')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) throw new DatabaseError('getProfileByEmail', error);
  return (data as ProfileRow | null) ?? null;
}

/** Groups components by category, preserving alphabetical order within groups. */
export function groupByCategory(components: ReadonlyArray<ComponentRow>): Array<{
  category: string;
  components: ComponentRow[];
}> {
  const groups = new Map<string, ComponentRow[]>();

  for (const component of components) {
    const existing = groups.get(component.category);
    if (existing) existing.push(component);
    else groups.set(component.category, [component]);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, grouped]) => ({ category, components: grouped }));
}

/**
 * The single authority on whether a caller may read a component's source.
 * Pure and synchronous so it can be unit-tested exhaustively.
 */
export function canAccessSource(
  tier: ComponentRow['tier'],
  viewer: { isAuthenticated: boolean; isPremium: boolean }
): { allowed: true } | { allowed: false; code: 'UNAUTHENTICATED' | 'PREMIUM_REQUIRED' } {
  if (tier === 'FREE') return { allowed: true };
  if (!viewer.isAuthenticated) return { allowed: false, code: 'UNAUTHENTICATED' };
  if (!viewer.isPremium) return { allowed: false, code: 'PREMIUM_REQUIRED' };
  return { allowed: true };
}
