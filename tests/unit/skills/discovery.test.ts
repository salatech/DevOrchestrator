import { describe, it, expect } from 'vitest';
import { discoverSkills } from '../../../src/skills/discovery.js';
import type { Skill } from '../../../src/skills/types.js';

describe('skills/discovery', () => {
  const sampleSkills: Skill[] = [
    {
      name: 'react',
      path: '/path/to/react',
      purpose: 'React development',
      content: 'react content',
      keywords: ['react', 'frontend', 'ui', 'component'],
      whenToUse: 'When building user interfaces with React'
    },
    {
      name: 'db',
      path: '/path/to/db',
      purpose: 'Database tasks',
      content: 'db content',
      keywords: ['sql', 'database', 'migration', 'table'],
      whenToUse: 'When modifying database schema or writing migrations'
    }
  ];

  it('matches frontend skill for React-related requests', () => {
    const results = discoverSkills('I need a new React component for the UI', sampleSkills);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('react');
  });

  it('matches database skill for migration requests', () => {
    const results = discoverSkills('Create a new SQL database migration', sampleSkills);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('db');
  });

  it('returns empty array when no skills match', () => {
    const results = discoverSkills('Do something completely unrelated like docker compose', sampleSkills);
    expect(results.length).toBe(0);
  });

  it('returns skills sorted by relevance', () => {
    const results = discoverSkills('react database migration', sampleSkills);
    expect(results.length).toBe(2);
    // Both match but one might score higher based on keyword exact matches.
    // Ensure it returns them sorted correctly.
    expect(results[0].relevanceScore).toBeGreaterThanOrEqual(results[1].relevanceScore);
  });
});
