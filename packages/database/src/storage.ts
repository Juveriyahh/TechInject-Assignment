import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, getServiceRoleClient } from './client';
import { getSupabaseServerEnv } from './env';
import type { ComponentBundle } from './schemas';

/**
 * Archives the raw uploaded bundle in a **private** bucket. The bucket is
 * created with `public = false` in migration 0002, so objects can never be
 * fetched through an unauthenticated public URL — a signed URL minted by the
 * service role is the only read path.
 */
export interface BundleArchiveResult {
  bucket: string;
  objectPath: string;
}

export interface StorageDeps {
  client?: SupabaseClient;
  bucket?: string;
}

function resolveBucket(deps?: StorageDeps): string {
  return deps?.bucket ?? getSupabaseServerEnv().SUPABASE_STORAGE_BUCKET;
}

/** Deterministic object key: `<slug>/<version>/bundle.json`. */
export function bundleObjectPath(slug: string, version: string): string {
  return `${slug}/${version}/bundle.json`;
}

export async function archiveBundle(bundle: ComponentBundle, deps?: StorageDeps): Promise<BundleArchiveResult> {
  const client = deps?.client ?? getServiceRoleClient();
  const bucket = resolveBucket(deps);
  const objectPath = bundleObjectPath(bundle.slug, bundle.version);

  const { error } = await client.storage
    .from(bucket)
    .upload(objectPath, JSON.stringify(bundle, null, 2), { contentType: 'application/json', upsert: true });

  if (error) throw new DatabaseError('archiveBundle', error);
  return { bucket, objectPath };
}

/** Mints a short-lived signed URL for an archived bundle (admin download). */
export async function createBundleSignedUrl(
  objectPath: string,
  expiresInSeconds = 60,
  deps?: StorageDeps
): Promise<string> {
  const client = deps?.client ?? getServiceRoleClient();
  const bucket = resolveBucket(deps);

  const { data, error } = await client.storage.from(bucket).createSignedUrl(objectPath, expiresInSeconds);
  if (error || !data) throw new DatabaseError('createBundleSignedUrl', error);
  return data.signedUrl;
}
