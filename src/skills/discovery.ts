import type { Skill } from './types.js';
import type { SkillContext } from '../context/types.js';

export function discoverSkills(request: string, skills: Skill[]): SkillContext[] {
  const requestWords = new Set(
    request
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2),
  );

  const scoredSkills = skills.map((skill) => {
    let score = 0;
    const skillWords = new Set(skill.keywords);
    const whenToUseWords = new Set(
      skill.whenToUse
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2),
    );

    for (const word of requestWords) {
      if (skillWords.has(word)) score += 1;
      if (whenToUseWords.has(word)) score += 0.5;
    }

    return { skill, score };
  });

  const threshold = 0.1;
  return scoredSkills
    .filter((s) => s.score > threshold)
    .sort((a, b) => b.score - a.score)
    .map((s) => ({
      name: s.skill.name,
      content: s.skill.content,
      relevanceScore: s.score,
    }));
}
