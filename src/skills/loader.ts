import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Skill } from './types.js';
import { fileExists, pathExists } from '../workspace/filesystem.js';

export function extractSection(content: string, heading: string): string {
  const lines = content.split('\n');
  let inSection = false;
  let sectionContent: string[] = [];
  const levelMatch = heading.match(/^(#+)/);
  const level = levelMatch ? levelMatch[1].length : 2;

  for (const line of lines) {
    const headingMatch = line.match(/^(#+)\s+(.+)$/);
    if (headingMatch) {
      if (headingMatch[2].toLowerCase() === heading.replace(/^#+\s*/, '').toLowerCase()) {
        inSection = true;
        continue;
      } else if (inSection && headingMatch[1].length <= level) {
        break;
      }
    }
    if (inSection) {
      sectionContent.push(line);
    }
  }
  return sectionContent.join('\n').trim();
}

export function extractKeywords(content: string): string[] {
  const words = content.toLowerCase().split(/[^a-z0-9]+/);
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
  ]);
  const keywords = words.filter((w) => w.length > 2 && !stopWords.has(w));
  return Array.from(new Set(keywords));
}

export async function loadSkill(skillDir: string): Promise<Skill | null> {
  const mdPath = path.join(skillDir, 'SKILL.md');
  if (!(await fileExists(mdPath))) {
    return null;
  }
  const content = await fs.readFile(mdPath, 'utf8');
  const name = path.basename(skillDir);
  const purpose = extractSection(content, '## Purpose');
  const whenToUse = extractSection(content, '## When To Use');
  const keywords = extractKeywords(content);

  return {
    name,
    path: skillDir,
    purpose,
    whenToUse,
    content,
    keywords,
  };
}

export async function loadSkills(projectRoot: string): Promise<Skill[]> {
  const skillsDir = path.join(projectRoot, '.ai', 'skills');
  if (!(await pathExists(skillsDir))) {
    return [];
  }

  const entries = await fs.readdir(skillsDir, { withFileTypes: true });
  const skills: Skill[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skill = await loadSkill(path.join(skillsDir, entry.name));
      if (skill) {
        skills.push(skill);
      }
    }
  }
  return skills;
}
