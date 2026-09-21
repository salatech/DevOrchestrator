import { defineCommand } from 'citty';
import * as p from '@clack/prompts';
import { PlanStatus } from '../plans/types.js';
import type { Plan } from '../plans/types.js';
import { formatPlan } from '../ui/display.js';
import { promptPlanApproval, promptConfirm, promptText, showWarning } from '../ui/prompts.js';
import { createAgentRuntime, openWorkspace, requireInitialized } from '../runtime.js';
import { fail, splitList } from './helpers.js';
import { parseChatPlan, assertImportedPlan } from '../plans/from-chat.js';
import {
  CHAT_SOURCES,
  buildBrowserPlanningPrompt,
  copyToClipboard,
  inboxPlanPath,
  inboxPromptPath,
  openInBrowser,
  readPlanReply,
  resolveChatSource,
  writeInboxFile,
  type ChatSource,
} from '../plans/chat-browser.js';
import { detectShareUrl, fetchShareConversation, isChatShareUrl } from '../plans/share-link.js';

export default defineCommand({
  meta: {
    name: 'plan',
    description:
      'Create a plan from a browser chatbot (ChatGPT / Gemini / Claude) or from an API planner',
  },
  args: {
    request: {
      type: 'positional',
      description: 'What you want to implement',
      required: false,
    },
    chat: {
      type: 'string',
      description: 'Browser chatbot: chatgpt, gemini, or claude (no API key)',
    },
    from: {
      type: 'string',
      description: 'Import a plan from a file (chat reply you saved)',
    },
    link: {
      type: 'string',
      description: 'Public share URL from ChatGPT, Gemini, or Claude',
    },
    include: {
      type: 'string',
      description: 'Comma-separated extra files to include in context',
    },
    yes: {
      type: 'boolean',
      alias: 'y',
      description: 'Approve the generated plan immediately',
      default: false,
    },
  },
  async run({ args }) {
    try {
      const chatFlag = args.chat;
      const wantsChat = typeof chatFlag === 'string';
      const fromFile = typeof args.from === 'string' ? args.from : undefined;
      const positional = args.request ? String(args.request) : undefined;
      const linkArg =
        (typeof args.link === 'string' && args.link) ||
        (positional && isChatShareUrl(positional) ? positional : undefined) ||
        (fromFile && isChatShareUrl(fromFile) ? fromFile : undefined);

      if (linkArg) {
        const plan = await importPlanFromShareLink({
          url: linkArg,
          request: positional && !isChatShareUrl(positional) ? positional : undefined,
        });
        await afterPlanCreated(plan, args.yes);
        return;
      }

      if (wantsChat || fromFile) {
        const source =
          resolveChatSource(chatFlag) ??
          (wantsChat ? await pickChatSource() : CHAT_SOURCES.chatgpt);
        const plan = await importPlanFromChat({
          source,
          request: args.request ? String(args.request) : undefined,
          fromFile,
          include: splitList(args.include),
          skipBrowser: Boolean(fromFile),
        });
        await afterPlanCreated(plan, args.yes);
        return;
      }

      if (!args.request) {
        fail(
          new Error(
            'Pass a request, a share link, or --chat chatgpt|gemini|claude. Example: devorch plan --link https://chatgpt.com/share/…',
          ),
        );
      }

      const runtime = await createAgentRuntime();
      for (const warning of runtime.warnings) showWarning(warning);
      runtime.progress.start();

      const plan = await runtime.orchestrator.plan({
        request: String(args.request),
        includeFiles: splitList(args.include),
      });

      runtime.progress.stop();
      await afterPlanCreated(plan, args.yes, {
        request: String(args.request),
        include: splitList(args.include),
      });
    } catch (error) {
      fail(error);
    }
  },
});

async function pickChatSource(): Promise<ChatSource> {
  const result = await p.select({
    message: 'Which browser chatbot should write the plan?',
    options: [
      { value: 'gemini', label: 'Gemini', hint: 'gemini.google.com' },
      { value: 'chatgpt', label: 'ChatGPT', hint: 'chatgpt.com' },
      { value: 'claude', label: 'Claude', hint: 'claude.ai' },
    ],
  });
  if (p.isCancel(result)) {
    p.cancel('Operation cancelled');
    process.exit(0);
  }
  return resolveChatSource(result) ?? CHAT_SOURCES.gemini;
}

async function importPlanFromShareLink(options: { url: string; request?: string }): Promise<Plan> {
  const runtime = await openWorkspace();
  await requireInitialized(runtime);
  p.intro('DevOrchestrator');
  p.log.info('Reading public share link…');

  const conversation = await fetchShareConversation(options.url);
  const detected = detectShareUrl(options.url);
  const userAsk =
    conversation.messages.find((message) => message.role === 'user')?.content ?? options.request;
  const request =
    options.request?.trim() || userAsk?.trim() || conversation.title || 'Imported from chat';

  await writeInboxFile(inboxPlanPath(runtime.root), conversation.planText);

  const git = await runtime.workspace.getGitState().catch(() => null);
  const nextId = await runtime.planManager.getNextId();
  const parsed = parseChatPlan(conversation.planText, request, `${conversation.service}-share`);
  assertImportedPlan(parsed, conversation.planText);
  const plan: Plan = {
    ...parsed,
    id: nextId,
    status: PlanStatus.AwaitingApproval,
    branch: git?.branch || parsed.branch || 'unknown',
    objective: parsed.objective?.trim() ? parsed.objective : request,
    currentState: parsed.currentState || `Imported from ${conversation.sourceUrl}`,
  };
  await runtime.planManager.createPlan(plan);
  p.log.success(
    `Imported ${plan.id} from ${detected?.service ?? conversation.service} (${conversation.title})`,
  );
  return plan;
}

async function importPlanFromChat(options: {
  source: ChatSource;
  request?: string;
  fromFile?: string;
  include?: string[];
  skipBrowser: boolean;
}): Promise<Plan> {
  const runtime = await openWorkspace();
  await requireInitialized(runtime);
  p.intro('DevOrchestrator');

  const request =
    options.request?.trim() ||
    (options.skipBrowser
      ? 'Imported from browser chat'
      : await promptText('What should the chatbot plan?', 'create a calculator app'));

  const git = await runtime.workspace.getGitState().catch(() => null);
  const context = await runtime.contextEngine.buildContext(
    request,
    runtime.workspace,
    runtime.planManager,
    { includeFiles: options.include },
  );

  if (!options.skipBrowser) {
    const prompt = buildBrowserPlanningPrompt(request, context);
    const promptPath = inboxPromptPath(runtime.root);
    await writeInboxFile(promptPath, prompt);
    const copied = await copyToClipboard(prompt);
    p.log.info(`Planning prompt saved to ${promptPath}`);
    if (copied) p.log.info('Copied to clipboard — paste it into the chat.');
    p.log.info(`Opening ${options.source.label} in your browser…`);
    try {
      await openInBrowser(options.source.url);
    } catch {
      p.log.warn(`Could not open the browser. Go to ${options.source.url} yourself.`);
    }
    p.log.info(
      [
        `In ${options.source.label}: paste the prompt, get a plan, copy the reply.`,
        `Then save it as ${inboxPlanPath(runtime.root)} (or leave it on the clipboard).`,
      ].join('\n'),
    );
    const typedPath = await promptText(
      'Press Enter when the plan is copied, or paste a share link / file path',
      'https://chatgpt.com/share/…  or  .ai/inbox/plan.md',
    );
    if (typedPath && isChatShareUrl(typedPath)) {
      return importPlanFromShareLink({ url: typedPath, request });
    }
    if (typedPath?.trim()) options.fromFile = typedPath.trim();
  }

  const typed = options.fromFile || undefined;
  if (typed && isChatShareUrl(typed)) {
    return importPlanFromShareLink({ url: typed, request });
  }
  const reply = await readPlanReply(runtime.root, typed);
  if (reply && isChatShareUrl(reply.trim().split(/\s+/)[0] ?? '')) {
    return importPlanFromShareLink({ url: reply.trim().split(/\s+/)[0]!, request });
  }
  if (!reply) {
    throw new Error(
      `No chatbot plan found. Save the reply to ${inboxPlanPath(runtime.root)} and run: devorch plan --from .ai/inbox/plan.md`,
    );
  }

  const nextId = await runtime.planManager.getNextId();
  const parsed = parseChatPlan(reply, request, `${options.source.id}-chat`);
  assertImportedPlan(parsed, reply);
  const plan: Plan = {
    ...parsed,
    id: nextId,
    status: PlanStatus.AwaitingApproval,
    branch: git?.branch || parsed.branch || 'unknown',
    objective: parsed.objective?.trim() ? parsed.objective : request,
  };
  await runtime.planManager.createPlan(plan);
  p.log.success(`Imported ${plan.id} from ${options.source.label}`);
  return plan;
}

async function afterPlanCreated(
  plan: Plan,
  yes: boolean,
  regenerate?: { request: string; include?: string[] },
): Promise<void> {
  console.log('\n' + formatPlan(plan) + '\n');

  let action: 'approve' | 'edit' | 'regenerate' | 'reject' = yes
    ? 'approve'
    : await promptPlanApproval();

  if (action === 'edit' && regenerate) {
    const notes = await promptText(
      'What should change in the plan?',
      'Be more specific about tests',
    );
    const runtime = await createAgentRuntime();
    await runtime.planManager.transitionStatus(plan.id, PlanStatus.Cancelled);
    runtime.progress.start();
    const revised = await runtime.orchestrator.plan({
      request: `${regenerate.request}\n\nAdditional instructions: ${notes}`,
      includeFiles: regenerate.include,
    });
    runtime.progress.stop();
    console.log('\n' + formatPlan(revised) + '\n');
    action = yes ? 'approve' : await promptPlanApproval();
    if (action === 'approve') {
      await runtime.planManager.transitionStatus(revised.id, PlanStatus.Approved);
      p.log.success(`Approved ${revised.id}`);
      const shouldExecute = yes || (await promptConfirm('Execute this plan now?'));
      if (shouldExecute) {
        runtime.progress.start();
        const report = await runtime.orchestrator.execute({ planId: revised.id });
        runtime.progress.stop();
        const { formatReport } = await import('../ui/display.js');
        console.log('\n' + formatReport(report));
      }
    } else if (action === 'reject') {
      await runtime.planManager.transitionStatus(revised.id, PlanStatus.Cancelled);
      p.log.warn(`Cancelled ${revised.id}`);
    }
  } else if (action === 'edit') {
    p.log.info(
      'Browser plans: change the chat reply, save .ai/inbox/plan.md, then run --from again.',
    );
  } else if (action === 'regenerate' && regenerate) {
    const runtime = await createAgentRuntime();
    await runtime.planManager.transitionStatus(plan.id, PlanStatus.Cancelled);
    runtime.progress.start();
    const regenerated = await runtime.orchestrator.plan({
      request: regenerate.request,
      includeFiles: regenerate.include,
    });
    runtime.progress.stop();
    console.log('\n' + formatPlan(regenerated) + '\n');
    p.log.info(`Generated ${regenerated.id} (previous plan cancelled)`);
  } else if (action === 'regenerate') {
    p.log.info(
      `Run again: devorch plan --chat ${plan.planner.replace(/-chat$/, '')} "your request"`,
    );
  } else if (action === 'reject') {
    const runtime = await openWorkspace();
    await runtime.planManager.transitionStatus(plan.id, PlanStatus.Cancelled);
    p.log.warn(`Cancelled ${plan.id}`);
  } else {
    const runtime = await openWorkspace();
    await runtime.planManager.transitionStatus(plan.id, PlanStatus.Approved);
    p.log.success(`Approved ${plan.id}`);
    const shouldExecute = yes ? false : await promptConfirm('Execute this plan now?');
    if (shouldExecute) {
      const agent = await createAgentRuntime();
      agent.progress.start();
      const report = await agent.orchestrator.execute({ planId: plan.id });
      agent.progress.stop();
      const { formatReport } = await import('../ui/display.js');
      console.log('\n' + formatReport(report));
    } else {
      p.log.info(`Next: \`devorch execute ${plan.id}\``);
    }
  }

  p.outro('Done');
}
