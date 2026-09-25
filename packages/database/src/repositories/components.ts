import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, getServiceRoleClient } from '../client';
import { normaliseDependencies, type ComponentBundle } from '../schemas';
import type { ComponentFileRow, ComponentRow, ComponentWithFiles } from '../types';

const COMPONENT_COLUMNS =
  'id, slug, name, description, category, tier, is_published, version, props_schema, dependencies, created_at, updated_at';

const FILE_COLUMNS = 'id, component_id, file_path, content, file_type, created_at';

export interface ComponentRepositoryDeps {
  /** Injectable for tests; defaults to the memoised service-role client. */
  client?: SupabaseClient;
}

function resolveClient(deps?: ComponentRepositoryDeps): SupabaseClient {
  return deps?.client ?? getServiceRoleClient();
}

/** Lists every component — drafts included. Admin-only by construction. */
export async function listComponents(deps?: ComponentRepositoryDeps): Promise<ComponentRow[]> {
  const { data, error } = await resolveClient(deps)
    .from('components')
    .select(COMPONENT_COLUMNS)
    .order('updated_at', { ascending: false });

  if (error) throw new DatabaseError('listComponents', error);
  return (data ?? []) as ComponentRow[];
}

/** Loads a single component together with its declared files. */
export async function getComponentWithFiles(
  componentId: string,
  deps?: ComponentRepositoryDeps
): Promise<ComponentWithFiles | null> {
  const client = resolveClient(deps);

  const { data: component, error } = await client
    .from('components')
    .select(COMPONENT_COLUMNS)
    .eq('id', componentId)
    .maybeSingle();

  if (error) throw new DatabaseError('getComponent', error);
  if (!component) return null;

  const { data: files, error: filesError } = await client
    .from('component_files')
    .select(FILE_COLUMNS)
    .eq('component_id', componentId)
    .order('file_path', { ascending: true });

  if (filesError) throw new DatabaseError('getComponentFiles', filesError);

  return { ...(component as ComponentRow), files: (files ?? []) as ComponentFileRow[] };
}

/**
 * Persists a validated bundle as a **draft** (`is_published = false`) and
 * replaces the component's file set. Re-uploading an existing slug bumps the
 * stored metadata and files, which is how new versions are published.
 */
export async function upsertComponentDraft(
  bundle: ComponentBundle,
  deps?: ComponentRepositoryDeps
): Promise<ComponentWithFiles> {
  const client = resolveClient(deps);
  const dependencies = normaliseDependencies(bundle.dependencies);

  const { data: component, error } = await client
    .from('components')
    .upsert(
      {
        slug: bundle.slug,
        name: bundle.name,
        description: bundle.description,
        category: bundle.category,
        tier: bundle.tier,
        version: bundle.version,
        props_schema: bundle.propsSchema,
        dependencies,
        // Uploads always land as drafts; publishing is a separate, explicit action.
        is_published: false
      },
      { onConflict: 'slug' }
    )
    .select(COMPONENT_COLUMNS)
    .single();

  if (error) throw new DatabaseError('upsertComponentDraft', error);

  const row = component as ComponentRow;

  const { error: deleteError } = await client.from('component_files').delete().eq('component_id', row.id);
  if (deleteError) throw new DatabaseError('clearComponentFiles', deleteError);

  const { data: files, error: insertError } = await client
    .from('component_files')
    .insert(
      bundle.files.map((file) => ({
        component_id: row.id,
        file_path: file.filePath,
        file_type: file.fileType,
        content: file.content
      }))
    )
    .select(FILE_COLUMNS);

  if (insertError) throw new DatabaseError('insertComponentFiles', insertError);

  return { ...row, files: (files ?? []) as ComponentFileRow[] };
}

/** Flips publication state. Unpublishing revokes public visibility immediately. */
export async function setComponentPublished(
  componentId: string,
  isPublished: boolean,
  deps?: ComponentRepositoryDeps
): Promise<ComponentRow | null> {
  const { data, error } = await resolveClient(deps)
    .from('components')
    .update({ is_published: isPublished })
    .eq('id', componentId)
    .select(COMPONENT_COLUMNS)
    .maybeSingle();

  if (error) throw new DatabaseError('setComponentPublished', error);
  return (data as ComponentRow | null) ?? null;
}

export async function deleteComponent(componentId: string, deps?: ComponentRepositoryDeps): Promise<void> {
  const { error } = await resolveClient(deps).from('components').delete().eq('id', componentId);
  if (error) throw new DatabaseError('deleteComponent', error);
}

export interface ComponentStats {
  total: number;
  published: number;
  drafts: number;
  premium: number;
}

/** Derives dashboard KPI figures from a component list. */
export function summariseComponents(components: ReadonlyArray<ComponentRow>): ComponentStats {
  return components.reduce<ComponentStats>(
    (stats, component) => ({
      total: stats.total + 1,
      published: stats.published + (component.is_published ? 1 : 0),
      drafts: stats.drafts + (component.is_published ? 0 : 1),
      premium: stats.premium + (component.tier === 'PREMIUM' ? 1 : 0)
    }),
    { total: 0, published: 0, drafts: 0, premium: 0 }
  );
}
