import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Plan, PlanStatus, PlanSummary } from './types.js';
import { parsePlanFile, parseFrontmatter } from './parser.js';
import { serializePlan } from './serializer.js';
import { validateTransition } from './state-machine.js';
import { validatePlan } from './validator.js';
import * as filesystem from '../workspace/filesystem.js';
import { PlanningError } from '../errors/index.js';

export class PlanManager {
  private plansDir: string;

  constructor(private projectRoot: string) {
    this.plansDir = path.join(projectRoot, '.ai', 'plans');
  }

  async createPlan(plan: Plan): Promise<Plan> {
    validatePlan(plan);
    const serialized = serializePlan(plan);
    const fullPath = this.buildPlanPath(plan);
    await fs.mkdir(this.plansDir, { recursive: true });
    await fs.writeFile(fullPath, serialized, 'utf8');
    return plan;
  }

  async loadPlan(id: string): Promise<Plan> {
    const fullPath = await this.findPlanFile(id);
    const content = await fs.readFile(fullPath, 'utf8');
    return parsePlanFile(content);
  }

  async updatePlan(id: string, updates: Partial<Plan>): Promise<Plan> {
    const existing = await this.loadPlan(id);
    const merged = { ...existing, ...updates, updated: new Date().toISOString() };
    validatePlan(merged);
    const fullPath = await this.findPlanFile(id);
    await fs.writeFile(fullPath, serializePlan(merged), 'utf8');
    return merged;
  }

  async listPlans(): Promise<PlanSummary[]> {
    if (!(await filesystem.pathExists(this.plansDir))) {
      return [];
    }
    const files = await fs.readdir(this.plansDir);
    const summaries: PlanSummary[] = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(this.plansDir, file), 'utf8');
      const { data } = parseFrontmatter<Partial<PlanSummary> & { id?: string }>(content);
      if (data?.id) {
        summaries.push({
          id: data.id,
          title: data.title ?? data.id,
          status: data.status as PlanStatus,
          created: data.created ?? '',
          updated: data.updated ?? data.created ?? '',
        });
      }
    }
    return summaries.sort((a, b) => a.id.localeCompare(b.id));
  }

  async transitionStatus(id: string, newStatus: PlanStatus): Promise<Plan> {
    const plan = await this.loadPlan(id);
    validateTransition(plan.status, newStatus);
    return this.updatePlan(id, { status: newStatus });
  }

  async getNextId(): Promise<string> {
    const summaries = await this.listPlans();
    let maxId = 0;
    for (const plan of summaries) {
      const match = plan.id.match(/^PLAN-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    }
    return `PLAN-${String(maxId + 1).padStart(3, '0')}`;
  }

  private buildPlanPath(plan: Plan): string {
    const titleKebab = plan.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const filename = titleKebab ? `${plan.id}-${titleKebab}.md` : `${plan.id}.md`;
    return path.join(this.plansDir, filename);
  }

  private async findPlanFile(id: string): Promise<string> {
    if (!(await filesystem.pathExists(this.plansDir))) {
      throw new PlanningError(`Plan not found: ${id}`, { planId: id });
    }

    const files = await fs.readdir(this.plansDir);
    const byName = files.find(
      (file) => file === `${id}.md` || (file.startsWith(`${id}-`) && file.endsWith('.md')),
    );
    if (byName) {
      return path.join(this.plansDir, byName);
    }

    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(this.plansDir, file), 'utf8');
      const { data } = parseFrontmatter<{ id?: string }>(content);
      if (data?.id === id) {
        return path.join(this.plansDir, file);
      }
    }

    throw new PlanningError(`Plan not found: ${id}`, { planId: id });
  }
}
