import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { WorkspaceManager } from '../../../src/workspace/manager.js';
import { buildChangeMaterial } from '../../../src/workspace/changes.js';

describe('workspace/changes', () => {
  it('prefers local file contents when git is absent', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'devorch-changes-'));
    await fs.writeFile(path.join(dir, 'index.html'), '<h1>calc</h1>\n');
    await fs.writeFile(path.join(dir, 'app.js'), 'console.log(1)\n');

    const workspace = new WorkspaceManager(dir);
    const result = await buildChangeMaterial(workspace, {
      preferredPaths: ['index.html', 'app.js'],
    });

    expect(result.source).toBe('local');
    expect(result.material).toContain('FILE: index.html');
    expect(result.material).toContain('<h1>calc</h1>');
    expect(result.material).toContain('FILE: app.js');
  });
});
