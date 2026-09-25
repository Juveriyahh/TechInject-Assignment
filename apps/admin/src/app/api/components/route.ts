import {
  archiveBundle,
  componentBundleSchema,
  listComponents,
  upsertComponentDraft
} from '@tech-inject/database';
import { jsonOk, readJsonBody, withAdminAuth } from '@/lib/api';
import { repositoryDeps } from '@/lib/repositories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Lists every component, drafts included. Admin-only. */
export const GET = withAdminAuth(async () => {
  const components = await listComponents(repositoryDeps());
  return jsonOk({ components });
});

/**
 * Creates (or re-uploads) a component from a JSON bundle. The payload is
 * validated with Zod before a single row is written, the component always lands
 * as a draft, and the raw bundle is archived in the private storage bucket.
 *
 * Uploaded code is only ever stored as text — it is never imported, evaluated
 * or executed by the server.
 */
export const POST = withAdminAuth(async (request: Request) => {
  const bundle = componentBundleSchema.parse(await readJsonBody(request));
  const component = await upsertComponentDraft(bundle, repositoryDeps());

  let archive: { bucket: string; objectPath: string } | null = null;
  try {
    archive = await archiveBundle(bundle, repositoryDeps());
  } catch (error) {
    // The database row is the source of truth; a storage hiccup must not lose
    // an otherwise valid upload, so it is reported rather than fatal.
    console.warn('Bundle archived skipped:', error instanceof Error ? error.message : error);
  }

  return jsonOk({ component, archive }, 201);
});
