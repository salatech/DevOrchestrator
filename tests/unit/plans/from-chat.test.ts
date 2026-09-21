import { describe, it, expect } from 'vitest';
import { parseChatPlan, assertImportedPlan } from '../../../src/plans/from-chat.js';
import { resolveChatSource } from '../../../src/plans/chat-browser.js';

describe('plans/from-chat', () => {
  it('parses a Gemini-style markdown plan', () => {
    const raw = `---
title: "Basic Calculator"
---

# Objective
Build a calculator with HTML CSS JS

# Files To Create
- index.html
- style.css
- app.js

# Implementation Steps

## Step 1: Markup
Create the calculator layout.

## Step 2: Logic
Wire button clicks.

# Acceptance Criteria
- Buttons work
`;
    const plan = parseChatPlan(raw, 'make a calculator', 'gemini-chat');
    expect(plan.title).toBe('Basic Calculator');
    expect(plan.filesToCreate).toEqual(['index.html', 'style.css', 'app.js']);
    expect(plan.implementationSteps).toHaveLength(2);
    expect(plan.implementationSteps[0].title).toBe('Markup');
    expect(plan.planner).toBe('gemini-chat');
    expect(plan.objective).toContain('calculator');
  });

  it('unwraps fenced replies and numbered lists', () => {
    const raw =
      '```markdown\n# Objective\nDo it\n\n# Implementation Steps\n1. Create index.html\n2. Add CSS\n```';
    const plan = parseChatPlan(raw, 'do it');
    expect(plan.implementationSteps.length).toBeGreaterThanOrEqual(2);
    expect(plan.implementationSteps[0].description).toContain('index.html');
  });

  it('keeps a stub fallback for the API planner', () => {
    const plan = parseChatPlan('Here is some loose advice with no steps.', 'do it', 'llm');
    expect(plan.planner).toBe('llm');
    expect(plan.implementationSteps[0]?.title).toBe('Implement request');
    expect(plan.implementationSteps[0]?.description).toContain('loose advice');
  });

  it('rejects a CLI command when importing from chat', () => {
    const raw = 'devorch plan --from reply.md';
    const plan = parseChatPlan(raw, 'calculator');
    expect(() => assertImportedPlan(plan, raw)).toThrow(/not a chatbot plan/);
  });

  it('rejects a stub chat import with no files or steps', () => {
    const raw = 'Sure, I can help with that.';
    const plan = parseChatPlan(raw, 'calculator');
    expect(() => assertImportedPlan(plan, raw)).toThrow(/not an implementation plan/);
  });

  it('picks up files mentioned in backticks', () => {
    const raw = `# Objective
Build it

# Implementation Steps
1. **Create files**
   Add \`index.html\`, \`style.css\`, and \`script.js\`.
2. **Wire logic**
   Handle clicks.
`;
    const plan = parseChatPlan(raw, 'calculator');
    expect(plan.filesToCreate).toEqual(['index.html', 'style.css', 'script.js']);
    expect(plan.implementationSteps).toHaveLength(2);
    expect(plan.implementationSteps[0].description).toContain('style.css');
  });
});

describe('plans/chat-browser', () => {
  it('maps provider nicknames to chat sites', () => {
    expect(resolveChatSource('openai')?.id).toBe('chatgpt');
    expect(resolveChatSource('google')?.id).toBe('gemini');
    expect(resolveChatSource('anthropic')?.id).toBe('claude');
  });
});
