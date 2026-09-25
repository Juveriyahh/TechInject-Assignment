import { z } from 'zod';

/**
 * Wire contracts shared by the catalogue API, the catalogue UI and the CLI.
 * Both sides validate against these schemas, so a drift between the server's
 * response and the installer's expectations fails loudly instead of silently
 * writing half a component to disk.
 */

export const componentTierSchema = z.enum(['FREE', 'PREMIUM']);
export const componentFileTypeSchema = z.enum(['SOURCE', 'PREVIEW_FIXTURE', 'STYLE', 'METADATA']);

export const componentPropSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'enum', 'node', 'object', 'array']),
  required: z.boolean(),
  default: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional(),
  description: z.string().optional(),
  options: z.array(z.string()).optional()
});

export type ComponentProp = z.infer<typeof componentPropSchema>;

/** Public metadata — safe to expose for every published component, any tier. */
export const componentSummarySchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  tier: componentTierSchema,
  version: z.string(),
  updatedAt: z.string()
});

export type ComponentSummary = z.infer<typeof componentSummarySchema>;

export const componentSourceFileSchema = z.object({
  filePath: z.string(),
  fileType: componentFileTypeSchema,
  content: z.string()
});

export type ComponentSourceFile = z.infer<typeof componentSourceFileSchema>;

/**
 * Full payload returned by `GET /api/components/:slug/source` — only ever sent
 * to an entitled caller.
 */
export const componentSourcePayloadSchema = z.object({
  component: componentSummarySchema,
  propsSchema: z.array(componentPropSchema),
  dependencies: z.object({
    npm: z.record(z.string()),
    internal: z.array(z.string())
  }),
  files: z.array(componentSourceFileSchema).min(1),
  /** Ready-to-paste `npx` command for this component. */
  installCommand: z.string(),
  /** Generated AI coding-assistant prompt. */
  agentPrompt: z.string()
});

export type ComponentSourcePayload = z.infer<typeof componentSourcePayloadSchema>;

/** Error body used by every public API route. */
export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.enum(['NOT_FOUND', 'UNAUTHENTICATED', 'PREMIUM_REQUIRED', 'BAD_REQUEST', 'SERVER_ERROR']).optional(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional()
});

export type ApiError = z.infer<typeof apiErrorSchema>;

/** Builds the canonical install command for a component slug. */
export function buildInstallCommand(slug: string, options?: { premium?: boolean }): string {
  const base = `npx @tech-inject/cli add ${slug}`;
  return options?.premium === true ? `${base} --token <your-access-token>` : base;
}
