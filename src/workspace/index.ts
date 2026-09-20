export { WorkspaceManager } from './manager.js';
export { GitManager } from './git.js';
export * from './types.js';
export * as filesystem from './filesystem.js';
export {
  detectProjectType,
  detectPackageManager,
  detectLanguages,
  detectFrameworks,
  readPackageInfo,
} from './detector.js';
