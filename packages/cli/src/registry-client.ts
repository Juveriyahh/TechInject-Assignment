import { apiErrorSchema, componentSourcePayloadSchema, type ComponentSourcePayload } from '@tech-inject/shared';

/**
 * Talks to the catalogue API. Every response is validated against the shared
 * contract before the installer is allowed to touch the filesystem.
 */
export const DEFAULT_REGISTRY_URL = 'https://catalogue.techinject.dev';

export class RegistryError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'RegistryError';
  }
}

export interface FetchComponentOptions {
  slug: string;
  /** Base URL of the catalogue, without a trailing slash. */
  registryUrl?: string;
  /** Access token for premium components. */
  token?: string | undefined;
  /** Injectable for tests. */
  fetchImpl?: typeof fetch;
}

/** Normalises a base URL and joins the source path. */
export function buildSourceUrl(registryUrl: string, slug: string): string {
  const base = registryUrl.replace(/\/+$/u, '');
  return `${base}/api/components/${encodeURIComponent(slug)}/source`;
}

export async function fetchComponentSource({
  slug,
  registryUrl = process.env.TECH_INJECT_REGISTRY_URL ?? DEFAULT_REGISTRY_URL,
  token,
  fetchImpl = fetch
}: FetchComponentOptions): Promise<ComponentSourcePayload> {
  const url = buildSourceUrl(registryUrl, slug);

  const headers: Record<string, string> = { accept: 'application/json' };
  if (token !== undefined && token.length > 0) headers.authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetchImpl(url, { headers });
  } catch (error) {
    throw new RegistryError(
      `Could not reach the registry at ${url}: ${error instanceof Error ? error.message : String(error)}`,
      0
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = apiErrorSchema.safeParse(body);
    const message = parsed.success ? parsed.data.error : `Registry request failed (${String(response.status)})`;
    const code = parsed.success ? parsed.data.code : undefined;

    if (response.status === 403) {
      throw new RegistryError(
        code === 'UNAUTHENTICATED'
          ? `${message} Pass --token <access-token> to authenticate.`
          : `${message} Your account is not entitled to this premium component.`,
        403,
        code
      );
    }
    if (response.status === 404) {
      throw new RegistryError(`Component "${slug}" was not found or is not published.`, 404, 'NOT_FOUND');
    }

    throw new RegistryError(message, response.status, code);
  }

  const payload = componentSourcePayloadSchema.safeParse(body);
  if (!payload.success) {
    throw new RegistryError('The registry returned an unexpected payload; refusing to write files.', 502);
  }

  return payload.data;
}
