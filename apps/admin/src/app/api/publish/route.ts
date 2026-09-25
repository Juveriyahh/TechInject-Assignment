import { publishActionSchema, setComponentPublished } from '@tech-inject/database';
import { jsonError, jsonOk, readJsonBody, withAdminAuth } from '@/lib/api';
import { repositoryDeps } from '@/lib/repositories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Flips a component between draft and published. Unpublishing takes effect
 * immediately: the RLS policies in migration 0002 hide unpublished rows and
 * their files from the anon and authenticated roles.
 */
export const POST = withAdminAuth(async (request: Request) => {
  const { componentId, isPublished } = publishActionSchema.parse(await readJsonBody(request));

  const component = await setComponentPublished(componentId, isPublished, repositoryDeps());
  if (!component) return jsonError('Component not found', 404);

  return jsonOk({ component });
});
