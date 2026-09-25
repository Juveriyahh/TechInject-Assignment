import { listPublishedComponents } from '@tech-inject/database';
import type { ComponentSummary } from '@tech-inject/shared/contracts';
import { jsonOk, mapErrorToResponse } from '@/lib/api';
import { repositoryDeps } from '@/lib/repositories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public metadata for every *published* component. Never includes file
 * contents, so it is safe for anonymous callers regardless of tier.
 */
export async function GET(): Promise<Response> {
  try {
    const components = await listPublishedComponents(repositoryDeps());

    const summaries: ComponentSummary[] = components.map((component) => ({
      slug: component.slug,
      name: component.name,
      description: component.description,
      category: component.category,
      tier: component.tier,
      version: component.version,
      updatedAt: component.updated_at
    }));

    return jsonOk({ components: summaries });
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
