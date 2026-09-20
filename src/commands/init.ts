import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import * as path from 'node:path';
import { ensureDirectory, writeFile, pathExists } from '../workspace/filesystem.js';
import { detectProjectType, detectPackageManager, detectLanguages, detectFrameworks, readPackageInfo } from '../workspace/detector.js';
import { WorkspaceManager } from '../workspace/manager.js';

export default defineCommand({
  meta: {
    name: 'init',
    description: 'Initializes .ai/ directory in the current project',
  },
  args: {},
  async run({ args }) {
    p.intro(pc.blue('DevOrchestrator Init'));
    try {
      const s = p.spinner();
      s.start('Detecting workspace root');
      const cwd = process.cwd();
      const projectRoot = await WorkspaceManager.findProjectRoot(cwd);
      s.stop(`Workspace root found at ${projectRoot}`);

      const aiDir = path.join(projectRoot, '.ai');
      
      const exists = await pathExists(aiDir);
      if (exists) {
        p.log.warn('.ai directory already exists in this project.');
      } else {
        s.start('Detecting project stack');
        const pm = await detectPackageManager(projectRoot);
        const langs = await detectLanguages(projectRoot);
        const frameworks = await detectFrameworks(projectRoot);
        const pkgInfo = await readPackageInfo(projectRoot);
        s.stop('Stack detected');

        const projectName = pkgInfo?.name || path.basename(projectRoot);
        const scripts = pkgInfo?.scripts ? Object.keys(pkgInfo.scripts).map(k => `${pm} run ${k}`).join('\n') : `${pm} test\n${pm} run build`;

        await ensureDirectory(path.join(aiDir, 'plans'));
        await ensureDirectory(path.join(aiDir, 'tasks'));
        await ensureDirectory(path.join(aiDir, 'skills'));
        await ensureDirectory(path.join(aiDir, 'state'));
        await ensureDirectory(path.join(aiDir, 'runs'));
        
        let projectMd = `# Project: ${projectName}\n\n## Purpose\n(Describe the purpose of this project)\n\n## Stack\n- Languages: ${langs.join(', ') || 'Unknown'}\n- Frameworks: ${frameworks.join(', ') || 'None detected'}\n- Package Manager: ${pm}\n\n## Architecture\nSee ARCHITECTURE.md for system details.\n\n## Development Commands\n\`\`\`bash\n${scripts}\n\`\`\`\n\n## Constraints\n(List important constraints)\n`;
        let archMd = `# Architecture\n\n## System Overview\n(Describe the overall system architecture)\n\n## Major Components\n(List and describe major components)\n\n## Data Flow\n(Describe how data flows through the system)\n\n## External Services\n(List external services and integrations)\n`;
        const convMd = `# Conventions\n\n## Coding Style\n(Describe coding conventions)\n\n## Naming\n(Describe naming conventions)\n\n## Testing\n(Describe testing conventions)\n\n## Architecture Rules\n(Describe architecture rules)\n`;

        // Attempt to auto-generate if API keys are available
        try {
          const { loadConfig } = await import('../config/loader.js');
          const { ModelOrchestrator } = await import('../providers/orchestrator.js');
          const config = await loadConfig(projectRoot);
          
          if (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) {
            s.start('Analyzing workspace to generate documentation...');
            const orchestrator = new ModelOrchestrator(config);
            const prompt = `You are an expert software architect analyzing a new project. 
Stack: ${langs.join(', ')} / ${frameworks.join(', ')} / ${pm}. 
Generate two markdown sections separated by "---SPLIT---". 
First section is PROJECT.md containing Purpose, Stack, Development Commands, and Constraints.
Second section is ARCHITECTURE.md containing System Overview, Major Components, and Data Flow.
Keep it concise and infer what you can from standard conventions for this stack.`;
            
            const response = await orchestrator.generate('planner', {
              systemPrompt: 'You generate accurate project documentation.',
              messages: [{ role: 'user', content: prompt }]
            });
            
            const parts = response.content.split('---SPLIT---');
            if (parts.length === 2) {
              projectMd = parts[0].trim();
              archMd = parts[1].trim();
            }
            s.stop('Generated project documentation');
          }
        } catch (error) {
          s.stop('Skipped auto-generation (no API key or error)');
          // fallback to stubs
        }

        await writeFile(path.join(aiDir, 'PROJECT.md'), projectMd);
        await writeFile(path.join(aiDir, 'ARCHITECTURE.md'), archMd);
        await writeFile(path.join(aiDir, 'CONVENTIONS.md'), convMd);
        
        await writeFile(path.join(aiDir, '.devai.json'), JSON.stringify({}, null, 2));
        
        p.log.success('Initialized .ai/ directory structure successfully.');
      }
    } catch (e: any) {
      p.log.error(`Initialization failed: ${e.message}`);
    }
    p.outro('Done');
  }
});
