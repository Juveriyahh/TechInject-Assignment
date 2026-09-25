import path from 'node:path';

/**
 * Path containment for the installer. Component bundles are authored by
 * administrators but *served over the network*, so the CLI treats every file
 * path in a payload as hostile until it has been proven to resolve inside the
 * chosen target directory.
 */
export class UnsafePathError extends Error {
  constructor(
    public readonly filePath: string,
    public readonly reason: string
  ) {
    super(`Refusing to write "${filePath}": ${reason}`);
    this.name = 'UnsafePathError';
  }
}

/** Characters that must never appear in a bundle file path. */
const FORBIDDEN_PATTERN = /[\0<>:"|?*]/u;

/** Windows device names that are illegal as file names. */
const RESERVED_BASENAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  'com1',
  'com2',
  'com3',
  'com4',
  'lpt1',
  'lpt2',
  'lpt3'
]);

/**
 * Syntactic checks that run before any filesystem resolution, so an attack is
 * rejected on its shape alone rather than on where it happens to land.
 */
export function assertSafeRelativePath(filePath: string): void {
  if (filePath.trim().length === 0) throw new UnsafePathError(filePath, 'path is empty');
  if (FORBIDDEN_PATTERN.test(filePath)) throw new UnsafePathError(filePath, 'path contains forbidden characters');
  if (path.isAbsolute(filePath)) throw new UnsafePathError(filePath, 'path is absolute');
  if (/^[A-Za-z]:/u.test(filePath)) throw new UnsafePathError(filePath, 'path names a Windows drive');
  if (filePath.startsWith('\\\\')) throw new UnsafePathError(filePath, 'path is a UNC network path');
  if (filePath.startsWith('~')) throw new UnsafePathError(filePath, 'path references a home directory');

  const segments = filePath.split(/[\\/]/u);
  for (const segment of segments) {
    if (segment === '..') throw new UnsafePathError(filePath, 'path traverses above the target directory');
    if (segment === '' && segments.indexOf(segment) !== segments.length - 1) {
      throw new UnsafePathError(filePath, 'path contains an empty segment');
    }
    const base = segment.split('.')[0]?.toLowerCase() ?? '';
    if (RESERVED_BASENAMES.has(base)) throw new UnsafePathError(filePath, `"${segment}" is a reserved device name`);
  }
}

export interface ResolveOptions {
  /** Absolute directory the component may be written into. */
  targetDirectory: string;
  /** Relative path declared by the bundle. */
  filePath: string;
}

/**
 * Resolves a bundle file path inside `targetDirectory` and proves containment.
 * Throws `UnsafePathError` rather than returning anything questionable.
 */
export function resolveSafeTargetPath({ targetDirectory, filePath }: ResolveOptions): string {
  assertSafeRelativePath(filePath);

  const root = path.resolve(targetDirectory);
  const resolved = path.resolve(root, filePath);
  const relative = path.relative(root, resolved);

  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new UnsafePathError(filePath, 'resolved path escapes the target directory');
  }

  return resolved;
}

/** True when the path resolves safely; never throws. */
export function isSafeRelativePath(filePath: string): boolean {
  try {
    assertSafeRelativePath(filePath);
    return true;
  } catch {
    return false;
  }
}
