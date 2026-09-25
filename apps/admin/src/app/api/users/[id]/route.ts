import { listProfiles, profileUpdateSchema, updateProfile, uuidSchema } from '@tech-inject/database';
import { jsonError, jsonOk, readJsonBody, withAdminAuth } from '@/lib/api';
import { repositoryDeps } from '@/lib/repositories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Grants or revokes premium access for a customer account. */
export const PATCH = withAdminAuth<RouteContext>(async (request, { params }) => {
  const { id } = await params;
  const profileId = uuidSchema.parse(id);
  const patch = profileUpdateSchema.parse(await readJsonBody(request));

  const profile = await updateProfile(profileId, patch, repositoryDeps());
  if (!profile) return jsonError('Customer not found', 404);

  return jsonOk({ profile });
});

export const GET = withAdminAuth<RouteContext>(async (_request, { params }) => {
  const { id } = await params;
  const profileId = uuidSchema.parse(id);

  const profiles = await listProfiles(repositoryDeps());
  const profile = profiles.find((candidate) => candidate.id === profileId);
  if (!profile) return jsonError('Customer not found', 404);

  return jsonOk({ profile });
});
