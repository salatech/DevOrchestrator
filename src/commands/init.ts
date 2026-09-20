import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { ensureDirectory, writeFile, pathExists } from '../workspace/filesystem.js';
import {
  detectProjectType,
  detectPackageManager,
  detectLanguages,
  detectFrameworks,
  readPackageInfo,
} from '../workspace/detector.js';
import { WorkspaceManager } from '../workspace/manager.js';
import { fail } from './helpers.js';
import type { PackageManager } from '../workspace/types.js';

function defaultValidationCommands(
  pm: PackageManager,
  scripts: Record<string, string> | undefined,
): string[] {
  const run = (script: string) => {
    if (pm === 'npm') return `npm run ${script}`;
    if (pm === 'yarn') return `yarn ${script}`;
    if (pm === 'bun') return `bun run ${script}`;
    return `pnpm ${script}`;
  };

  const commands: string[] = [];
  if (scripts?.test) commands.push(run('test'));
  if (scripts?.typecheck) commands.push(run('typecheck'));
  else if (scripts?.lint) commands.push(run('lint'));
  return commands;
}

function skillMarkdown(name: string, purpose: string, whenToUse: string): string {
  return `# ${name}

## Purpose
${purpose}

## When To Use
${whenToUse}
`;
}

async function writeIfMissing(filePath: string, content: string): Promise<boolean> {
  if (await pathExists(filePath)) return false;
  await writeFile(filePath, content);
  return true;
}

async function ensureGitignore(projectRoot: string): Promise<void> {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  const entries = ['.ai/state/', '.ai/runs/'];

  if (!(await pathExists(gitignorePath))) {
    await writeFile(gitignorePath, `${entries.join('\n')}\n`);
    return;
  }

  const current = await fs.readFile(gitignorePath, 'utf8');
  const missing = entries.filter(
    (entry) => !current.split('\n').some((line) => line.trim() === entry),
  );
  if (missing.length === 0) return;
  const suffix = current.endsWith('\n') ? '' : '\n';
  await fs.appendFile(
    gitignorePath,
    `${suffix}\n# DevOrchestrator runtime\n${missing.join('\n')}\n`,
  );
}

export default defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize the .ai/ directory in the current project',
  },
  args: {
    force: {
      type: 'boolean',
      description: 'Overwrite stub documentation if it already exists',
      default: false,
    },
  },
  async run({ args }) {
    p.intro(pc.bgCyan(pc.black(' DevOrchestrator ')));
    try {
      const s = p.spinner();
      s.start('Detecting workspace root');
      const projectRoot = await WorkspaceManager.findProjectRoot(process.cwd());
      s.stop(`Workspace root: ${projectRoot}`);

      const aiDir = path.join(projectRoot, '.ai');
      const alreadyExists = await pathExists(aiDir);

      s.start('Detecting project stack');
      const projectType = await detectProjectType(projectRoot);
      const pm = await detectPackageManager(projectRoot);
      const langs = await detectLanguages(projectRoot);
      const frameworks = await detectFrameworks(projectRoot);
      const pkgInfo = await readPackageInfo(projectRoot);
      s.stop(
        `Detected ${projectType} / ${langs.join(', ') || 'unknown'} / ${frameworks.join(', ') || 'none'}`,
      );

      await ensureDirectory(path.join(aiDir, 'plans'));
      await ensureDirectory(path.join(aiDir, 'tasks'));
      await ensureDirectory(path.join(aiDir, 'skills'));
      await ensureDirectory(path.join(aiDir, 'state'));
      await ensureDirectory(path.join(aiDir, 'runs'));

      const projectName = pkgInfo?.name || path.basename(projectRoot);
      const scriptLines = pkgInfo?.scripts
        ? Object.keys(pkgInfo.scripts)
            .map((key) => `${pm === 'unknown' ? 'npm' : pm} ${key}`)
            .join('\n')
        : `${pm} test\n${pm} build`;

      let projectMd = `# Project: ${projectName}

## Purpose
(Describe the purpose of this project)

## Stack
- Languages: ${langs.join(', ') || 'Unknown'}
- Frameworks: ${frameworks.join(', ') || 'None detected'}
- Package Manager: ${pm}
- Project type: ${projectType}

## Architecture
See ARCHITECTURE.md for system details.

## Development Commands
\`\`\`bash
${scriptLines}
\`\`\`

## Constraints
(List important constraints)
`;
      let archMd = `# Architecture

## System Overview
(Describe the overall system architecture)

## Major Components
(List and describe major components)

## Data Flow
(Describe how data flows through the system)

## External Services
(List external services and integrations)
`;
      const convMd = `# Conventions

## Coding Style
(Describe coding conventions)

## Naming
(Describe naming conventions)

## Testing
(Describe testing conventions)

## Architecture Rules
(Describe architecture rules)
`;

      if (
        process.env.OPENAI_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.GOOGLE_API_KEY
      ) {
        try {
          s.start('Analyzing workspace to generate documentation...');
          const { loadConfig } = await import('../config/loader.js');
          const { ModelOrchestrator } = await import('../providers/orchestrator.js');
          const config = await loadConfig(projectRoot);
          const orchestrator = new ModelOrchestrator(config);
          const response = await orchestrator.generate('planner', {
            systemPrompt: 'You generate accurate, concise project documentation in Markdown.',
            messages: [
              {
                role: 'user',
                content: `Analyze this project and generate two markdown documents separated by "---SPLIT---".
Stack: ${langs.join(', ')} / ${frameworks.join(', ')} / ${pm}.
First document: PROJECT.md with Purpose, Stack, Development Commands, and Constraints.
Second document: ARCHITECTURE.md with System Overview, Major Components, and Data Flow.`,
              },
            ],
          });
          const parts = response.content.split('---SPLIT---');
          if (parts.length >= 2) {
            projectMd = parts[0].trim() + '\n';
            archMd = parts[1].trim() + '\n';
          }
          s.stop('Generated project documentation');
        } catch {
          s.stop('Skipped auto-generation (no usable API key)');
        }
      }

      const writeDoc = async (relative: string, content: string) => {
        const fullPath = path.join(aiDir, relative);
        if (args.force) {
          await writeFile(fullPath, content);
          return true;
        }
        return writeIfMissing(fullPath, content);
      };

      await writeDoc('PROJECT.md', projectMd);
      await writeDoc('ARCHITECTURE.md', archMd);
      await writeDoc('CONVENTIONS.md', convMd);

      const defaultConfig = {
        planner: { provider: 'openai', model: 'gpt-4o' },
        executor: { agent: 'codex' },
        reviewer: { provider: 'openai', model: 'gpt-4o' },
        validation: { commands: defaultValidationCommands(pm, pkgInfo?.scripts) },
        limits: { maxIterations: 3, maxContextFiles: 30 },
        security: { commandPolicies: {} },
      };
      await writeDoc('.devai.json', JSON.stringify(defaultConfig, null, 2) + '\n');
      await writeIfMissing(path.join(aiDir, '.gitignore'), 'state/\nruns/\n');

      await writeIfMissing(
        path.join(aiDir, 'skills', 'testing', 'SKILL.md'),
        skillMarkdown(
          'testing',
          'How to write and run tests for this project.',
          'When adding features, fixing bugs, or changing behavior that needs verification.',
        ),
      );

      if (langs.includes('typescript') || langs.includes('javascript')) {
        await writeIfMissing(
          path.join(aiDir, 'skills', 'typescript', 'SKILL.md'),
          skillMarkdown(
            'typescript',
            'TypeScript/JavaScript conventions for this repository.',
            'When editing application source, types, or module boundaries.',
          ),
        );
      }

      await ensureGitignore(projectRoot);

      if (alreadyExists && !args.force) {
        p.log.info('Ensured .ai/ structure exists. Pass --force to regenerate stub docs.');
      } else {
        p.log.success('Initialized .ai/ directory.');
      }

      p.log.info(`Config: ${path.join(aiDir, '.devai.json')}`);
      p.log.info('Next: `devorch plan "your request"`');
    } catch (error) {
      fail(error);
    }
    p.outro('Done');
  },
});
