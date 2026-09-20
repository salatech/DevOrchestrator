import type { ProjectType, PackageManager, Language, Framework, PackageInfo } from './types.js';
import { fileExists, readFile } from './filesystem.js';
import * as path from 'node:path';
import { WorkspaceError } from '../errors/index.js';

/**
 * Check for project type by detecting standard configuration files
 * @param root The workspace root path
 * @returns The detected project type
 */
export async function detectProjectType(root: string): Promise<ProjectType> {
  if (await fileExists(path.join(root, 'package.json'))) return 'nodejs';
  if (await fileExists(path.join(root, 'Cargo.toml'))) return 'rust';
  if (await fileExists(path.join(root, 'pyproject.toml')) || await fileExists(path.join(root, 'requirements.txt'))) return 'python';
  if (await fileExists(path.join(root, 'go.mod'))) return 'go';
  if (await fileExists(path.join(root, 'pom.xml')) || await fileExists(path.join(root, 'build.gradle'))) return 'java';
  if (await fileExists(path.join(root, 'Gemfile'))) return 'ruby';
  
  try {
    const fs = await import('node:fs/promises');
    const files = await fs.readdir(root);
    if (files.some(f => f.endsWith('.csproj'))) return 'dotnet';
  } catch {}

  return 'unknown';
}

/**
 * Detect package manager based on lockfiles
 * @param root The workspace root path
 * @returns The detected package manager
 */
export async function detectPackageManager(root: string): Promise<PackageManager> {
  if (await fileExists(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (await fileExists(path.join(root, 'yarn.lock'))) return 'yarn';
  if (await fileExists(path.join(root, 'bun.lock')) || await fileExists(path.join(root, 'bun.lockb'))) return 'bun';
  if (await fileExists(path.join(root, 'package-lock.json'))) return 'npm';
  if (await fileExists(path.join(root, 'Cargo.lock'))) return 'cargo';
  if (await fileExists(path.join(root, 'poetry.lock'))) return 'pip';
  if (await fileExists(path.join(root, 'go.sum'))) return 'go';
  
  return 'unknown';
}

/**
 * Detect programming languages used in the project
 * @param root The workspace root path
 * @returns Array of detected languages
 */
export async function detectLanguages(root: string): Promise<Language[]> {
  const languages: Language[] = [];
  
  if (await fileExists(path.join(root, 'tsconfig.json'))) languages.push('typescript');
  if (await fileExists(path.join(root, 'package.json'))) languages.push('javascript');
  if (await fileExists(path.join(root, 'pyproject.toml')) || await fileExists(path.join(root, 'requirements.txt'))) languages.push('python');
  if (await fileExists(path.join(root, 'Cargo.toml'))) languages.push('rust');
  if (await fileExists(path.join(root, 'go.mod'))) languages.push('go');
  
  return languages;
}

/**
 * Detect frameworks based on config files and dependencies
 * @param root The workspace root path
 * @returns Array of detected frameworks
 */
export async function detectFrameworks(root: string): Promise<Framework[]> {
  const frameworks: Set<Framework> = new Set();
  
  try {
    const fs = await import('node:fs/promises');
    const files = await fs.readdir(root);
    
    // Check config files
    if (files.some(f => f.startsWith('next.config.'))) frameworks.add('nextjs');
    if (files.some(f => f.startsWith('nuxt.config.'))) frameworks.add('nuxt');
    if (files.some(f => f.startsWith('svelte.config.'))) frameworks.add('sveltekit');
    
    // Check package.json dependencies
    const packageInfo = await readPackageInfo(root);
    if (packageInfo) {
      const deps = { ...packageInfo.dependencies, ...packageInfo.devDependencies };
      
      if (deps['next']) frameworks.add('nextjs');
      if (deps['react'] && !frameworks.has('nextjs')) frameworks.add('react');
      if (deps['vue']) frameworks.add('vue');
      if (deps['nuxt']) frameworks.add('nuxt');
      if (deps['@sveltejs/kit']) frameworks.add('sveltekit');
      if (deps['svelte'] && !frameworks.has('sveltekit')) frameworks.add('svelte');
      if (deps['express']) frameworks.add('express');
      if (deps['fastify']) frameworks.add('fastify');
      if (deps['@nestjs/core']) frameworks.add('nestjs');
    }

    if (files.some(f => f.startsWith('vite.config.'))) {
      // Very basic check without parsing the actual vite config file
      const viteConfig = await readFile(path.join(root, files.find(f => f.startsWith('vite.config.'))!)).catch(() => '');
      if (viteConfig.includes('@vitejs/plugin-react')) frameworks.add('react');
    }
  } catch (error) {
    // Ignore read errors
  }

  // Basic Python check for Django (could check requirements.txt)
  try {
    const reqText = await readFile(path.join(root, 'requirements.txt')).catch(() => '');
    const pyprojectText = await readFile(path.join(root, 'pyproject.toml')).catch(() => '');
    if (reqText.includes('Django') || pyprojectText.includes('Django')) frameworks.add('django');
  } catch (error) {
    // Ignore errors
  }
  
  return Array.from(frameworks);
}

/**
 * Read and parse package.json
 * @param root The workspace root path
 * @returns Parsed PackageInfo or null if not found
 */
export async function readPackageInfo(root: string): Promise<PackageInfo | null> {
  const packagePath = path.join(root, 'package.json');
  if (await fileExists(packagePath)) {
    try {
      const content = await readFile(packagePath);
      return JSON.parse(content) as PackageInfo;
    } catch (error: any) {
      throw new WorkspaceError(`Failed to parse package.json: ${error.message}`);
    }
  }
  return null;
}
