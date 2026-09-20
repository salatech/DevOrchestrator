import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { ExecutionTrace } from './types.js';
import { fileExists } from '../workspace/filesystem.js';

export class ExecutionTracer {
  private runsDir: string;

  constructor(private projectRoot: string) {
    this.runsDir = path.join(projectRoot, '.ai', 'runs');
  }

  async save(trace: ExecutionTrace): Promise<string> {
    await fs.mkdir(this.runsDir, { recursive: true });
    const id = trace.id || await this.getNextId();
    trace.id = id;
    const filename = `${id}.json`;
    await fs.writeFile(path.join(this.runsDir, filename), JSON.stringify(trace, null, 2), 'utf8');
    return id;
  }

  async load(id: string): Promise<ExecutionTrace> {
    const filename = `${id}.json`;
    const fullPath = path.join(this.runsDir, filename);
    if (!await fileExists(fullPath)) {
      throw new Error(`Trace not found: ${id}`);
    }
    const content = await fs.readFile(fullPath, 'utf8');
    return JSON.parse(content) as ExecutionTrace;
  }

  async list(): Promise<{ id: string; planId: string; status: string; startedAt: string }[]> {
    if (!await fileExists(this.runsDir)) return [];
    
    const entries = await fs.readdir(this.runsDir);
    const list = [];
    
    for (const entry of entries) {
      if (entry.endsWith('.json')) {
        const trace = await this.load(entry.replace('.json', ''));
        list.push({
          id: trace.id,
          planId: trace.planId,
          status: trace.status,
          startedAt: trace.startedAt
        });
      }
    }
    return list;
  }

  async getNextId(): Promise<string> {
    if (!await fileExists(this.runsDir)) return 'RUN-001';
    const entries = await fs.readdir(this.runsDir);
    let maxId = 0;
    for (const entry of entries) {
      const match = entry.match(/^RUN-(\d+)\.json$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxId) maxId = num;
      }
    }
    return `RUN-${String(maxId + 1).padStart(3, '0')}`;
  }
}
