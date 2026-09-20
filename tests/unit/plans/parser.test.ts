import { describe, it, expect } from 'vitest';
import { parsePlanFile, parseFrontmatter, parseMarkdownList, parseImplementationSteps } from '../../../src/plans/parser.js';
import type { PlanStatus } from '../../../src/plans/types.js';

describe('plans/parser', () => {
  describe('parseFrontmatter', () => {
    it('parses valid YAML frontmatter and returns body correctly', () => {
      const content = `---\nfoo: bar\nnum: 42\n---\nBody content`;
      const result = parseFrontmatter(content);
      expect(result.data).toEqual({ foo: 'bar', num: 42 });
      expect(result.body).toBe('Body content');
    });

    it('handles content without frontmatter', () => {
      const content = `Just some text`;
      const result = parseFrontmatter(content);
      expect(result.data).toEqual({});
      expect(result.body).toBe('Just some text');
    });

    it('throws on invalid YAML', () => {
      const content = `---\ninvalid: [yaml\n---\nBody`;
      expect(() => parseFrontmatter(content)).toThrow(/Invalid frontmatter/);
    });
  });

  describe('parseMarkdownList', () => {
    it('extracts items from bullet lists (- and *)', () => {
      const section = `- Item 1\n* Item 2\n- Item 3`;
      expect(parseMarkdownList(section)).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

    it('handles empty section', () => {
      expect(parseMarkdownList('')).toEqual([]);
      expect(parseMarkdownList('   \n  ')).toEqual([]);
    });
  });

  describe('parseImplementationSteps', () => {
    it('extracts numbered steps with titles and descriptions', () => {
      const section = `## Step 1: First step\nDescription of first step\nMore description\n\n## Step 2: Second step\nDesc`;
      const steps = parseImplementationSteps(section);
      expect(steps).toHaveLength(2);
      expect(steps[0]).toEqual({
        number: 1,
        title: 'First step',
        description: 'Description of first step\nMore description',
      });
      expect(steps[1]).toEqual({
        number: 2,
        title: 'Second step',
        description: 'Desc',
      });
    });
  });

  describe('parsePlanFile', () => {
    const validPlan = `---
id: PLAN-001
title: Add user authentication
status: draft
created: 2026-01-01
planner: gpt-4o
branch: main
---

# Objective
Add basic user authentication.

# Relevant Files
- src/auth.ts
- src/routes/login.ts

# Implementation Steps

## Step 1: Create auth module
Create the authentication module.

## Step 2: Add login route
Add the login API route.

# Acceptance Criteria
- Users can log in
- Sessions are maintained`;

    it('parses a complete valid plan file with all sections', () => {
      const plan = parsePlanFile(validPlan);
      expect(plan.id).toBe('PLAN-001');
      expect(plan.title).toBe('Add user authentication');
      expect(plan.status).toBe('draft');
      expect(plan.created).toBe('2026-01-01');
      expect(plan.planner).toBe('gpt-4o');
      expect(plan.branch).toBe('main');
      
      expect(plan.objective).toBe('Add basic user authentication.');
      expect(plan.relevantFiles).toEqual(['src/auth.ts', 'src/routes/login.ts']);
      
      expect(plan.implementationSteps).toHaveLength(2);
      expect(plan.implementationSteps[0].title).toBe('Create auth module');
      
      expect(plan.acceptanceCriteria).toEqual(['Users can log in', 'Sessions are maintained']);
    });

    it('handles missing optional sections (defaults to empty)', () => {
      const minimalPlan = `---
id: PLAN-002
title: Minimal plan
status: draft
---

# Objective
Minimal objective`;
      const plan = parsePlanFile(minimalPlan);
      expect(plan.relevantFiles).toEqual([]);
      expect(plan.filesToModify).toEqual([]);
      expect(plan.implementationSteps).toEqual([]);
      expect(plan.testingStrategy).toBe('');
    });

    it('throws on missing required fields (id, title)', () => {
      const invalidPlan = `---
status: draft
---
# Objective
Foo`;
      expect(() => parsePlanFile(invalidPlan)).toThrow(/Missing required frontmatter fields/);
    });
  });
});
