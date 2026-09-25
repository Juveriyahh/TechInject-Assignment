/**
 * Minimal in-memory stand-in for `SupabaseClient`, covering exactly the query
 * shapes the repositories in this package use. It lets the API and repository
 * tests assert real persistence behaviour (drafts default to unpublished,
 * premium toggles write through) without a live Postgres instance.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type FakeRow = Record<string, unknown>;

export interface FakeTables {
  profiles: FakeRow[];
  components: FakeRow[];
  component_files: FakeRow[];
}

type TableName = keyof FakeTables;

export interface FakeResult<T> {
  data: T;
  error: { message: string; code?: string } | null;
}

let idCounter = 0;

function nextId(): string {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
}

/** Resets the deterministic id sequence between tests. */
export function resetFakeIds(): void {
  idCounter = 0;
}

type Operation = 'select' | 'insert' | 'upsert' | 'update' | 'delete';

class FakeQuery implements PromiseLike<FakeResult<FakeRow[]>> {
  private operation: Operation = 'select';
  private readonly filters: Array<[string, unknown]> = [];
  private payload: FakeRow[] = [];
  private conflictColumn: string | null = null;
  private orderColumn: string | null = null;
  private orderAscending = true;

  constructor(
    private readonly tables: FakeTables,
    private readonly table: TableName
  ) {}

  /** Column projection is irrelevant to the fake; rows are returned whole. */
  select(_columns?: string): this {
    return this;
  }

  insert(rows: FakeRow | FakeRow[]): this {
    this.operation = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  upsert(rows: FakeRow | FakeRow[], options?: { onConflict?: string }): this {
    this.operation = 'upsert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    this.conflictColumn = options?.onConflict ?? null;
    return this;
  }

  update(patch: FakeRow): this {
    this.operation = 'update';
    this.payload = [patch];
    return this;
  }

  delete(): this {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderColumn = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  async maybeSingle(): Promise<FakeResult<FakeRow | null>> {
    const { data, error } = await this.run();
    return { data: data[0] ?? null, error };
  }

  async single(): Promise<FakeResult<FakeRow | null>> {
    const { data, error } = await this.run();
    if (!error && data.length === 0) {
      return { data: null, error: { message: 'No rows returned', code: 'PGRST116' } };
    }
    return { data: data[0] ?? null, error };
  }

  then<TResult1 = FakeResult<FakeRow[]>, TResult2 = never>(
    onFulfilled?: ((value: FakeResult<FakeRow[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onFulfilled, onRejected);
  }

  private matches(row: FakeRow): boolean {
    return this.filters.every(([column, value]) => row[column] === value);
  }

  private rows(): FakeRow[] {
    return this.tables[this.table];
  }

  private run(): Promise<FakeResult<FakeRow[]>> {
    const now = new Date().toISOString();
    const rows = this.rows();

    switch (this.operation) {
      case 'insert': {
        const inserted = this.payload.map((row) => ({ id: nextId(), created_at: now, ...row }));
        rows.push(...inserted);
        return Promise.resolve({ data: inserted, error: null });
      }
      case 'upsert': {
        const affected: FakeRow[] = [];
        for (const row of this.payload) {
          const key = this.conflictColumn;
          const existingIndex = key ? rows.findIndex((candidate) => candidate[key] === row[key]) : -1;
          if (existingIndex >= 0) {
            const existing = rows[existingIndex] as FakeRow;
            const merged = { ...existing, ...row, updated_at: now };
            rows[existingIndex] = merged;
            affected.push(merged);
          } else {
            const created = { id: nextId(), created_at: now, updated_at: now, ...row };
            rows.push(created);
            affected.push(created);
          }
        }
        return Promise.resolve({ data: affected, error: null });
      }
      case 'update': {
        const patch = this.payload[0] ?? {};
        const affected: FakeRow[] = [];
        rows.forEach((row, index) => {
          if (!this.matches(row)) return;
          const merged = { ...row, ...patch, updated_at: now };
          rows[index] = merged;
          affected.push(merged);
        });
        return Promise.resolve({ data: affected, error: null });
      }
      case 'delete': {
        const remaining: FakeRow[] = [];
        const removed: FakeRow[] = [];
        for (const row of rows) {
          if (this.matches(row)) removed.push(row);
          else remaining.push(row);
        }
        rows.splice(0, rows.length, ...remaining);

        // Emulate `on delete cascade` for component files.
        if (this.table === 'components') {
          const removedIds = new Set(removed.map((row) => row.id));
          const keptFiles = this.tables.component_files.filter((file) => !removedIds.has(file.component_id));
          this.tables.component_files.splice(0, this.tables.component_files.length, ...keptFiles);
        }

        return Promise.resolve({ data: removed, error: null });
      }
      default: {
        let selected = rows.filter((row) => this.matches(row));
        const column = this.orderColumn;
        if (column) {
          const direction = this.orderAscending ? 1 : -1;
          selected = [...selected].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * direction);
        }
        return Promise.resolve({ data: selected, error: null });
      }
    }
  }
}

export interface FakeSupabase {
  client: SupabaseClient;
  tables: FakeTables;
  uploads: Array<{ bucket: string; path: string; body: string }>;
}

/** Builds a fake client plus direct access to its backing tables. */
export function createFakeSupabase(seed?: Partial<FakeTables>): FakeSupabase {
  const tables: FakeTables = {
    profiles: seed?.profiles ?? [],
    components: seed?.components ?? [],
    component_files: seed?.component_files ?? []
  };

  const uploads: FakeSupabase['uploads'] = [];

  const client = {
    from: (table: TableName) => new FakeQuery(tables, table),
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, body: string) => {
          uploads.push({ bucket, path, body });
          return Promise.resolve({ data: { path }, error: null });
        },
        createSignedUrl: (path: string, expiresIn: number) =>
          Promise.resolve({
            data: { signedUrl: `https://fake.supabase.test/${bucket}/${path}?expires=${String(expiresIn)}` },
            error: null
          })
      })
    }
  } as unknown as SupabaseClient;

  return { client, tables, uploads };
}
