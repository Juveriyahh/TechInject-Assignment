import { deleteComponent, getComponentWithFiles, uuidSchema } from '@tech-inject/database';
import { jsonError, jsonOk, withAdminAuth } from '@/lib/api';
import { repositoryDeps } from '@/lib/repositories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Next.js 15 delivers dynamic route params as a promise. */
interface RouteContext {
  params: Promise<{ id: string }>;
}

export const GET = withAdminAuth<RouteContext>(async (_request, { params }) => {
  const { id } = await params;
  const componentId = uuidSchema.parse(id);

  const component = await getComponentWithFiles(componentId, repositoryDeps());
  if (!component) return jsonError('Component not found', 404);

  return jsonOk({ component });
});

export const DELETE = withAdminAuth<RouteContext>(async (_request, { params }) => {
  const { id } = await params;
  const componentId = uuidSchema.parse(id);

  const existing = await getComponentWithFiles(componentId, repositoryDeps());
  if (!existing) return jsonError('Component not found', 404);

  await deleteComponent(componentId, repositoryDeps());
  return jsonOk({ ok: true, deletedId: componentId });
});
