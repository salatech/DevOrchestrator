import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import pc from 'picocolors';
import { openWorkspace, requireInitialized } from '../runtime.js';
import { fail } from './helpers.js';

export default defineCommand({
  meta: {
    name: 'context',
    description: 'Show files included in and excluded from planner context',
  },
  args: {
    request: {
      type: 'positional',
      description: 'Request used to score relevant files',
      required: false,
      default: 'general',
    },
  },
  async run({ args }) {
    try {
      p.intro(pc.bgCyan(pc.black(' DevOrchestrator ')));
      const runtime = await openWorkspace();
      await requireInitialized(runtime);

      const s = p.spinner();
      s.start('Building context...');
      const inspection = await runtime.contextEngine.inspectContext(
        String(args.request ?? 'general'),
        runtime.workspace,
        runtime.planManager,
      );
      s.stop('Context assembled');

      console.log(pc.bold('\nDocs'));
      for (const doc of inspection.docs) {
        console.log(
          `${doc.loaded ? pc.green('✓ included') : pc.yellow('• missing')}  ${doc.path}${
            doc.loaded ? '' : pc.dim(' — file not found')
          }`,
        );
      }

      console.log(pc.bold(`\nIncluded (${inspection.included.length})`));
      if (inspection.included.length === 0) {
        console.log(pc.dim('  (no source files selected)'));
      }
      for (const file of inspection.included) {
        console.log(
          `  ${pc.green('✓')} ${file.path} ${pc.dim(`(${file.relevanceScore.toFixed(2)} — ${file.reason})`)}`,
        );
      }

      const excludedPreview = inspection.excluded.slice(0, 25);
      console.log(pc.bold(`\nExcluded (${inspection.excluded.length})`));
      if (inspection.excluded.length === 0) {
        console.log(pc.dim('  (nothing eligible was left out)'));
      }
      for (const file of excludedPreview) {
        console.log(`  ${pc.yellow('•')} ${file.path} ${pc.dim(`— ${file.reason}`)}`);
      }
      if (inspection.excluded.length > excludedPreview.length) {
        console.log(pc.dim(`  … ${inspection.excluded.length - excludedPreview.length} more`));
      }

      console.log(pc.bold(`\nSkills matched (${inspection.skills.length})`));
      for (const skill of inspection.skills) {
        console.log(`  ${pc.green('✓')} ${skill.name}`);
      }
      if (inspection.skills.length === 0) {
        console.log(pc.dim('  (none)'));
      }

      console.log(
        pc.dim(
          '\nSecrets, .env files, keys, and dependency/build directories are never included in model context.',
        ),
      );

      p.outro('Done');
    } catch (error) {
      fail(error);
    }
  },
});
