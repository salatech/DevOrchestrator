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

  private getPlanPath(id: string): string {
    return path.join(this.plansDir, `${id}.md`);
  }

  private extractIdFromFilename(filename: string): string | null {
    const match = filename.match(/^(PLAN-\d{3})/);
    return match ? match[1] : null;
  }

  async createPlan(plan: Plan): Promise<Plan> {
    validatePlan(plan);
    const serialized = serializePlan(plan);
    const titleKebab = plan.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const filename = `${plan.id}-${titleKebab}.md`;
    const fullPath = path.join(this.plansDir, filename);
    await fs.mkdir(this.plansDir, { recursive: true });
    await fs.writeFile(fullPath, serialized, 'utf8');
    return plan;
  }

  async loadPlan(id: string): Promise<Plan> {
    const exists = await filesystem.fileExists(this.plansDir);
    if (!exists) throw new PlanningError(`Plan not found: ${id}`);
    
    const files = await fs.readdir(this.plansDir);
    const filename = files.find(f => f.startsWith(`${id}-`) && f.endsWith('.md'));
    if (!filename) {
      throw new PlanningError(`Plan not found: ${id}`);
    }
    const fullPath = path.join(this.plansDir, filename);
    const content = await fs.readFile(fullPath, 'utf8');
    return parsePlanFile(content);
  }

  async updatePlan(id: string, updates: Partial<Plan>): Promise<Plan> {
    const existing = await this.loadPlan(id);
    const merged = { ...existing, ...updates, updated: new Date().toISOString() };
    validatePlan(merged);
    
    const files = await fs.readdir(this.plansDir);
    const filename = files.find(f => f.startsWith(`${id}-`) && f.endsWith('.md'));
    if (filename) {
      const fullPath = path.join(this.plansDir, filename);
      const serialized = serializePlan(merged);
      await fs.writeFile(fullPath, serialized, 'utf8');
    }
    return merged;
  }

  async listPlans(): Promise<PlanSummary[]> {
    if (!await filesystem.fileExists(this.plansDir)) {
      return [];
    }
    const files = await fs.readdir(this.plansDir);
    const summaries: PlanSummary[] = [];
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const content = await fs.readFile(path.join(this.plansDir, file), 'utf8');
      const { data } = parseFrontmatter<any>(content);
      if (data && data.id) {
        summaries.push({
          id: data.id,
          title: data.title,
          status: data.status,
          created: data.created,
          updated: data.updated
        });
      }
    }
    return summaries;
  }

  async transitionStatus(id: string, newStatus: PlanStatus): Promise<Plan> {
    const plan = await this.loadPlan(id);
    validateTransition(plan.status, newStatus);
    return this.updatePlan(id, { status: newStatus });
  }

  async getNextId(): Promise<string> {
    if (!await filesystem.fileExists(this.plansDir)) {
      return 'PLAN-001';
    }
    const files = await fs.readdir(this.plansDir);
    let maxId = 0;
    for (const file of files) {
      const id = this.extractIdFromFilename(file);
      if (id) {
        const num = parseInt(id.replace('PLAN-', ''), 10);
        if (num > maxId) maxId = num;
      }
    }
    return `PLAN-${String(maxId + 1).padStart(3, '0')}`;
  }
}
