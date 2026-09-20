/** A loaded skill */
export interface Skill {
  /** Skill name (derived from directory name) */
  name: string;
  /** Path to the skill directory */
  path: string;
  /** Skill purpose (from SKILL.md) */
  purpose: string;
  /** When this skill should be applied (from SKILL.md) */
  whenToUse: string;
  /** Full SKILL.md content */
  content: string;
  /** Keywords for matching */
  keywords: string[];
}
