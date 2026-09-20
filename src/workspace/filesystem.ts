import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { FileInfo, ListFilesOptions } from './types.js';
import { WorkspaceError, SecurityError } from '../errors/index.js';

/**
 * Resolves a path and ensures it does not escape the workspace root.
 * Throws a SecurityError if path traversal is detected.
 */
export function enforceSafePath(root: string, targetPath: string): string {
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(root, targetPath);

  // Ensure the resolved path starts with the absolute root exactly
  // Adding path.sep ensures we don't match '/root/workspace2' when root is '/root/workspace'
  if (resolved !== absoluteRoot && !resolved.startsWith(absoluteRoot + path.sep)) {
    throw new SecurityError(
      `Path traversal detected: Access denied to path outside workspace boundaries (${targetPath})`,
    );
  }
  return resolved;
}

// Default directories and files to always exclude
const DEFAULT_EXCLUDES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.output',
  '__pycache__',
  '.pytest_cache',
  'target',
  'coverage',
  '.nyc_output',
  '.turbo',
  '.cache',
  '.DS_Store',
  'Thumbs.db',
];

// Default file extensions for source code
const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rs',
  '.go',
  '.java',
  '.rb',
  '.cs',
  '.html',
  '.css',
  '.scss',
  '.vue',
  '.svelte',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.md',
  '.sql',
  '.graphql',
  '.prisma',
  '.env.example',
  '.gitignore',
  'Dockerfile',
  'docker-compose.yml',
];

/**
 * Reads file content, throws WorkspaceError if not found
 * @param filePath The path to the file
 * @returns The file content as a string
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error: any) {
    throw new WorkspaceError(`Failed to read file ${filePath}: ${error.message}`);
  }
}

/**
 * Writes file, creates parent dirs if needed
 * @param filePath The path to the file
 * @param content The content to write
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  try {
    await ensureDirectory(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error: any) {
    throw new WorkspaceError(`Failed to write file ${filePath}: ${error.message}`);
  }
}

/**
 * Deletes a file. No-ops if the file does not exist.
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error?.code === 'ENOENT') return;
    throw new WorkspaceError(`Failed to delete file ${filePath}: ${error.message}`);
  }
}

/**
 * Returns true when a path looks like a secret or credential file.
 */
export function isSecretPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  const base = path.basename(normalized);
  const lower = base.toLowerCase();
  const dir = path.dirname(normalized).toLowerCase();

  if (lower === '.env.example' || lower.endsWith('.env.example')) return false;

  if (lower === '.env' || lower.startsWith('.env.')) return true;
  if (/\.(pem|key|p12|pfx|keystore|jks)$/i.test(lower)) return true;
  if (/^(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/.test(lower)) return true;
  if (lower.startsWith('credentials.') || lower === 'credentials') return true;
  if (lower.startsWith('secrets.') || lower === 'secrets' || lower.startsWith('secret.'))
    return true;
  if (/service-account/i.test(lower)) return true;
  if (lower === '.netrc' || lower === '.pypirc') return true;
  if (lower === 'application_default_credentials.json') return true;
  if (dir.includes('/.ssh') && !lower.endsWith('.pub')) return true;
  if (dir.includes('/.aws') || dir.includes('/.gcloud')) return true;
  return false;
}

/** Human-readable reason a path is kept out of AI context. */
export function getContextExclusionReason(filePath: string): string | null {
  const base = path.basename(filePath);
  const parts = filePath.split(/[\\/]/);
  if (parts.some((part) => DEFAULT_EXCLUDES.includes(part))) {
    return `excluded directory (${parts.find((part) => DEFAULT_EXCLUDES.includes(part))})`;
  }
  if (isSecretPath(filePath)) {
    return `secret or credential file (${base})`;
  }
  const ext = path.extname(base);
  const isSourceExt = SOURCE_EXTENSIONS.includes(ext) || SOURCE_EXTENSIONS.includes(base);
  if (!isSourceExt) {
    return 'not a source file';
  }
  return null;
}

/**
 * Checks if file exists and is a file
 * @param filePath The path to the file
 * @returns true if the file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Checks if a path exists (file or directory)
 * @param targetPath The path
 * @returns true if it exists
 */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lists all source files recursively, respecting excludes. Returns relative paths. Implements depth limiting.
 * @param dir The directory to search in
 * @param options The options for listing files
 * @returns Array of relative file paths
 */
export async function listFiles(dir: string, options: ListFilesOptions = {}): Promise<string[]> {
  const excludeSet = new Set([...DEFAULT_EXCLUDES, ...(options.exclude || [])]);
  const results: string[] = [];
  const maxDepth = options.maxDepth;

  async function walk(currentDir: string, depth: number) {
    if (maxDepth !== undefined && depth > maxDepth) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error: any) {
      throw new WorkspaceError(`Failed to read directory ${currentDir}: ${error.message}`);
    }

    for (const entry of entries) {
      if (excludeSet.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        if (isSecretPath(fullPath) || isSecretPath(entry.name)) continue;
        const ext = path.extname(entry.name);
        const isSourceExt =
          SOURCE_EXTENSIONS.includes(ext) || SOURCE_EXTENSIONS.includes(entry.name);
        if (isSourceExt) {
          results.push(path.relative(dir, fullPath));
        }
      }
    }
  }

  await walk(dir, 0);
  return results;
}

/**
 * Returns file info for directory tree
 * @param dir The directory path
 * @param maxDepth The maximum depth to recurse
 * @returns Array of FileInfo objects
 */
export async function readDirectory(dir: string, maxDepth?: number): Promise<FileInfo[]> {
  const results: FileInfo[] = [];

  async function walk(currentDir: string, depth: number) {
    if (maxDepth !== undefined && depth > maxDepth) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error: any) {
      throw new WorkspaceError(`Failed to read directory ${currentDir}: ${error.message}`);
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const info = await getFileStats(fullPath);
      results.push(info);

      if (info.isDirectory) {
        await walk(fullPath, depth + 1);
      }
    }
  }

  await walk(dir, 0);
  return results;
}

/**
 * Gets stats for a single file
 * @param filePath The file path
 * @returns FileInfo object
 */
export async function getFileStats(filePath: string): Promise<FileInfo> {
  try {
    const stat = await fs.stat(filePath);
    return {
      path: filePath,
      size: stat.size,
      isDirectory: stat.isDirectory(),
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch (error: any) {
    throw new WorkspaceError(`Failed to get stats for ${filePath}: ${error.message}`);
  }
}

/**
 * Creates directory and parents if needed
 * @param dirPath The directory path
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error: any) {
    throw new WorkspaceError(`Failed to create directory ${dirPath}: ${error.message}`);
  }
}
