/** Programmatic API — used by tests and by anything embedding the installer. */
export { installComponent, selectInstallableFiles } from './installer';
export type { InstallOptions, InstallResult, InstalledFile, InstallFileOutcome } from './installer';
export {
  buildSourceUrl,
  DEFAULT_REGISTRY_URL,
  fetchComponentSource,
  RegistryError
} from './registry-client';
export type { FetchComponentOptions } from './registry-client';
export { buildProgram, main } from './program';
