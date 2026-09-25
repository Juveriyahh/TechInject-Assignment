import fs from 'node:fs/promises';
import path from 'node:path';
import {
  renderDependencyCommand,
  resolveSafeTargetPath,
  UnsafePathError,
  type ComponentSourcePayload,
  type ComponentSourceFile
} from '@tech-inject/shared';

/**
 * Writes a fetched component into the consumer's project.
 *
 * Safety rules, in order:
 *   1. every declared path is proven to resolve inside the target directory
 *      (`resolveSafeTargetPath` rejects absolute paths, `..`, UNC paths, drive
 *      letters, reserved device names and null bytes),
 *   2. an existing file is never overwritten unless `force` is set — it is
 *      reported as skipped instead,
 *   3. nothing is written at all until every path in the bundle has been
 *      validated, so a malicious entry cannot leave a half-installed tree.
 */
export type InstallFileOutcome = 'written' | 'skipped-exists' | 'unchanged';

export interface InstalledFile {
  filePath: string;
  absolutePath: string;
  outcome: InstallFileOutcome;
}

export interface InstallOptions {
  payload: ComponentSourcePayload;
  /** Directory components are written into, relative to `cwd` or absolute. */
  targetDirectory: string;
  /** Project root used to resolve a relative `targetDirectory`. */
  cwd?: string;
  /** Overwrite files that already exist. */
  force?: boolean;
  /** Validate and report without touching the filesystem. */
  dryRun?: boolean;
  /** Also write `PREVIEW_FIXTURE` files (off by default). */
  includeFixtures?: boolean;
}

export interface InstallResult {
  targetDirectory: string;
  files: InstalledFile[];
  /** Files that already existed and were left alone. */
  skipped: InstalledFile[];
  /** `npm install …` line, or `null` when no packages are needed. */
  dependencyCommand: string | null;
  internalDependencies: string[];
}

/** Which files from a payload are installed for the given options. */
export function selectInstallableFiles(
  payload: ComponentSourcePayload,
  includeFixtures: boolean
): ComponentSourceFile[] {
  return payload.files.filter((file) =>
    includeFixtures ? file.fileType !== 'METADATA' : file.fileType === 'SOURCE' || file.fileType === 'STYLE'
  );
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function installComponent({
  payload,
  targetDirectory,
  cwd = process.cwd(),
  force = false,
  dryRun = false,
  includeFixtures = false
}: InstallOptions): Promise<InstallResult> {
  const root = path.isAbsolute(targetDirectory) ? targetDirectory : path.resolve(cwd, targetDirectory);

  // The target directory itself must stay inside the project.
  const relativeRoot = path.relative(path.resolve(cwd), root);
  if (relativeRoot.startsWith('..') || path.isAbsolute(relativeRoot)) {
    throw new UnsafePathError(targetDirectory, 'target directory is outside the project root');
  }

  const selected = selectInstallableFiles(payload, includeFixtures);
  if (selected.length === 0) {
    throw new Error('The component payload contains no installable files.');
  }

  // Phase 1 — validate every path before writing anything.
  const planned = selected.map((file) => ({
    file,
    absolutePath: resolveSafeTargetPath({ targetDirectory: root, filePath: file.filePath })
  }));

  // Phase 2 — write.
  const results: InstalledFile[] = [];

  for (const { file, absolutePath } of planned) {
    const exists = await pathExists(absolutePath);

    if (exists && !force) {
      results.push({ filePath: file.filePath, absolutePath, outcome: 'skipped-exists' });
      continue;
    }

    if (exists) {
      const current = await fs.readFile(absolutePath, 'utf8');
      if (current === file.content) {
        results.push({ filePath: file.filePath, absolutePath, outcome: 'unchanged' });
        continue;
      }
    }

    if (!dryRun) {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, file.content, 'utf8');
    }

    results.push({ filePath: file.filePath, absolutePath, outcome: 'written' });
  }

  const dependencyCommand = renderDependencyCommand(payload.dependencies.npm);

  return {
    targetDirectory: root,
    files: results,
    skipped: results.filter((entry) => entry.outcome === 'skipped-exists'),
    dependencyCommand: dependencyCommand.length > 0 ? dependencyCommand : null,
    internalDependencies: payload.dependencies.internal
  };
}
