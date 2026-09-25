/** Domain types mirroring the SQL schema in `migrations/`. */

export const USER_ROLES = ['CUSTOMER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const COMPONENT_TIERS = ['FREE', 'PREMIUM'] as const;
export type ComponentTier = (typeof COMPONENT_TIERS)[number];

export const COMPONENT_FILE_TYPES = ['SOURCE', 'PREVIEW_FIXTURE', 'STYLE', 'METADATA'] as const;
export type ComponentFileType = (typeof COMPONENT_FILE_TYPES)[number];

/** A single declared prop of a published component. */
export interface ComponentPropDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'node' | 'object' | 'array';
  required: boolean;
  default?: string | number | boolean | null;
  description?: string;
  /** Allowed values when `type` is `enum`. */
  options?: string[];
}

/** External npm dependencies plus internal design-library imports. */
export interface ComponentDependencies {
  /** npm package name -> semver range. */
  npm: Record<string, string>;
  /** Internal `@tech-inject/ui` export names this component relies on. */
  internal: string[];
}

export interface ProfileRow {
  id: string;
  email: string;
  role: UserRole;
  is_premium: boolean;
  created_at: string;
}

export interface ComponentRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  tier: ComponentTier;
  is_published: boolean;
  version: string;
  props_schema: ComponentPropDefinition[];
  dependencies: ComponentDependencies;
  created_at: string;
  updated_at: string;
}

export interface ComponentFileRow {
  id: string;
  component_id: string;
  file_path: string;
  content: string;
  file_type: ComponentFileType;
  created_at: string;
}

/** A component row joined with its declared files. */
export interface ComponentWithFiles extends ComponentRow {
  files: ComponentFileRow[];
}

/** Minimal typing of the tables this package touches. */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<ProfileRow, 'id'>>;
        Relationships: [];
      };
      components: {
        Row: ComponentRow;
        Insert: Omit<ComponentRow, 'id' | 'created_at' | 'updated_at'> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ComponentRow, 'id'>>;
        Relationships: [];
      };
      component_files: {
        Row: ComponentFileRow;
        Insert: Omit<ComponentFileRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<ComponentFileRow, 'id'>>;
        Relationships: [];
      };
    };
  };
}
