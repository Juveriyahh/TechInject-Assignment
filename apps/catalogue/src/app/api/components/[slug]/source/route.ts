import {
  canAccessSource,
  getPublishedComponentBySlug,
  getPublishedComponentWithFiles,
  slugSchema
} from '@tech-inject/database';
import { buildAgentPrompt, buildInstallCommand, type ComponentSourcePayload } from '@tech-inject/shared';
import { jsonError, jsonOk, mapErrorToResponse } from '@/lib/api';
import { repositoryDeps } from '@/lib/repositories';
import { resolveViewer } from '@/lib/viewer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * The single gate in front of component source code.
 *
 * Order of checks matters and is deliberate:
 *   1. the slug must be well formed,
 *   2. the component must exist **and be published** — otherwise 404, so a
 *      draft slug is indistinguishable from a typo,
 *   3. entitlement is evaluated from the live `profiles` row,
 *   4. only then are file contents loaded from the database.
 *
 * A caller who fails step 3 never reaches a query that reads `content`, so
 * premium source cannot leak through this route even by accident.
 */
export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  try {
    const { slug: rawSlug } = await params;
    const parsedSlug = slugSchema.safeParse(rawSlug);
    if (!parsedSlug.success) return jsonError('Component not found', 404, 'NOT_FOUND');

    const deps = repositoryDeps();
    const metadata = await getPublishedComponentBySlug(parsedSlug.data, deps);
    if (!metadata) return jsonError('Component not found', 404, 'NOT_FOUND');

    const viewer = await resolveViewer(request);
    const access = canAccessSource(metadata.tier, viewer);

    if (!access.allowed) {
      return jsonError(
        access.code === 'UNAUTHENTICATED'
          ? 'Sign in with a premium account to access this component.'
          : 'This component requires a premium plan. Upgrade to unlock its source, CLI command and agent prompt.',
        403,
        access.code
      );
    }

    const component = await getPublishedComponentWithFiles(parsedSlug.data, deps);
    if (!component) return jsonError('Component not found', 404, 'NOT_FOUND');

    const summary = {
      slug: component.slug,
      name: component.name,
      description: component.description,
      category: component.category,
      tier: component.tier,
      version: component.version,
      updatedAt: component.updated_at
    };

    const dependencies = {
      npm: component.dependencies?.npm ?? {},
      internal: component.dependencies?.internal ?? []
    };

    const files = component.files.map((file) => ({
      filePath: file.file_path,
      fileType: file.file_type,
      content: file.content
    }));

    const payload: ComponentSourcePayload = {
      component: summary,
      propsSchema: component.props_schema,
      dependencies,
      files,
      installCommand: buildInstallCommand(component.slug, { premium: component.tier === 'PREMIUM' }),
      agentPrompt: buildAgentPrompt({
        component: summary,
        propsSchema: component.props_schema,
        dependencies,
        files,
        includeSource: true
      })
    };

    const response = jsonOk(payload);
    // Entitlement is per-viewer and revocable, so nothing here may be cached.
    response.headers.set('Cache-Control', 'no-store, private');
    return response;
  } catch (error) {
    return mapErrorToResponse(error);
  }
}
