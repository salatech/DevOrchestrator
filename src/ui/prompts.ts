import * as p from '@clack/prompts';
import pc from 'picocolors';

/**
 * Ask the user to approve, edit, or reject a plan.
 */
export async function promptPlanApproval(): Promise<'approve' | 'edit' | 'regenerate' | 'reject'> {
  const result = await p.select({
    message: 'What would you like to do with this plan?',
    options: [
      { value: 'approve', label: 'Approve', hint: 'Execute this plan' },
      { value: 'edit', label: 'Edit', hint: 'Modify before approving' },
      { value: 'regenerate', label: 'Regenerate', hint: 'Create a new plan' },
      { value: 'reject', label: 'Reject', hint: 'Cancel this plan' },
    ],
  });

  if (p.isCancel(result)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  return result as 'approve' | 'edit' | 'regenerate' | 'reject';
}

/**
 * Ask the user to confirm an action.
 */
export async function promptConfirm(message: string): Promise<boolean> {
  const result = await p.confirm({ message });

  if (p.isCancel(result)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  return result;
}

/**
 * Ask the user for text input.
 */
export async function promptText(message: string, placeholder?: string): Promise<string> {
  const result = await p.text({
    message,
    placeholder,
  });

  if (p.isCancel(result)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }

  return result;
}

/**
 * Ask the user to approve a command execution.
 */
export async function promptCommandApproval(command: string, reason: string): Promise<boolean> {
  console.log('');
  console.log(pc.yellow('⚠ Command requires approval:'));
  console.log(`  ${pc.bold(command)}`);
  console.log(`  ${pc.dim(reason)}`);

  return promptConfirm('Allow this command?');
}

/**
 * Show an error message and exit.
 */
export function showError(message: string): void {
  p.log.error(pc.red(message));
}

/**
 * Show a warning message.
 */
export function showWarning(message: string): void {
  p.log.warn(pc.yellow(message));
}

/**
 * Show a success message.
 */
export function showSuccess(message: string): void {
  p.log.success(pc.green(message));
}

/**
 * Show an info message.
 */
export function showInfo(message: string): void {
  p.log.info(message);
}
