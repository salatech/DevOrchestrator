import * as p from '@clack/prompts';
import pc from 'picocolors';
import type { ProgressEvent } from '../core/types.js';

/**
 * Create a progress handler for terminal display.
 * Uses Clack's spinner and log methods for staged progress output.
 */
export function createProgressHandler(): {
  handler: (event: ProgressEvent) => void;
  start: () => void;
  stop: () => void;
} {
  const spinner = p.spinner();
  let isSpinning = false;

  function stopSpinner(message?: string): void {
    if (isSpinning) {
      spinner.stop(message);
      isSpinning = false;
    }
  }

  function startSpinner(message: string): void {
    stopSpinner();
    spinner.start(message);
    isSpinning = true;
  }

  const handler = (event: ProgressEvent): void => {
    switch (event.stage) {
      case 'understanding':
        p.log.step(pc.dim(`Understanding request: ${event.message}`));
        break;

      case 'analyzing':
        startSpinner('Analyzing workspace...');
        break;

      case 'building_context':
        if (event.fileCount !== undefined) {
          stopSpinner(pc.green(`${event.fileCount} relevant files selected`));
        } else {
          startSpinner('Building context...');
        }
        break;

      case 'planning':
        startSpinner('Generating implementation plan...');
        break;

      case 'plan_generated':
        stopSpinner(pc.green(`Plan ${event.plan.id} generated`));
        break;

      case 'awaiting_approval':
        stopSpinner();
        p.log.info('Waiting for approval...');
        break;

      case 'executing':
        if (event.iteration) {
          startSpinner(`Executing (iteration ${event.iteration})...`);
        } else {
          startSpinner('Executing...');
        }
        break;

      case 'validating':
        startSpinner('Running validation...');
        break;

      case 'reviewing':
        startSpinner('Reviewing implementation...');
        break;

      case 'fixing':
        startSpinner(`Fixing issues (iteration ${event.iteration})...`);
        break;

      case 'completed':
        stopSpinner(pc.green('Execution completed'));
        break;

      case 'failed':
        stopSpinner(pc.red(`Failed: ${event.error}`));
        break;
    }
  };

  return {
    handler,
    start: () => {
      p.intro(pc.bgCyan(pc.black(' DevOrchestrator ')));
    },
    stop: () => {
      stopSpinner();
    },
  };
}
