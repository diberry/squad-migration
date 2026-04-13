import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../src/state/manager';
import { FileStatus } from '../../src/types/state';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('MigrationState', () => {
  let tmpDir: string;
  let manager: StateManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'state-test-'));
    manager = new StateManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should track file statuses', async () => {
    const state = await manager.initState('test-migration', ['a.js', 'b.js', 'c.js']);
    expect(state.files['a.js'].status).toBe(FileStatus.PENDING);

    await manager.updateFileStatus('test-migration', 'a.js', FileStatus.IN_PROGRESS);
    const updated = await manager.getState('test-migration');
    expect(updated!.files['a.js'].status).toBe(FileStatus.IN_PROGRESS);

    await manager.updateFileStatus('test-migration', 'a.js', FileStatus.MIGRATED);
    const migrated = await manager.getState('test-migration');
    expect(migrated!.files['a.js'].status).toBe(FileStatus.MIGRATED);

    await manager.updateFileStatus('test-migration', 'b.js', FileStatus.FAILED, 'parse error');
    const failed = await manager.getState('test-migration');
    expect(failed!.files['b.js'].status).toBe(FileStatus.FAILED);
    expect(failed!.files['b.js'].error).toBe('parse error');

    await manager.updateFileStatus('test-migration', 'c.js', FileStatus.SKIPPED);
    const skipped = await manager.getState('test-migration');
    expect(skipped!.files['c.js'].status).toBe(FileStatus.SKIPPED);
  });

  it('should persist state to disk', async () => {
    await manager.initState('persist-test', ['x.ts']);
    const filePath = path.join(tmpDir, 'persist-test-migration-state.json');
    expect(fs.existsSync(filePath)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(raw.configName).toBe('persist-test');
    expect(raw.files['x.ts'].status).toBe('pending');
  });

  it('should hydrate state from disk on startup', async () => {
    await manager.initState('hydrate-test', ['file1.js', 'file2.js']);
    await manager.updateFileStatus('hydrate-test', 'file1.js', FileStatus.MIGRATED);

    const freshManager = new StateManager(tmpDir);
    const state = await freshManager.getState('hydrate-test');
    expect(state).not.toBeNull();
    expect(state!.files['file1.js'].status).toBe(FileStatus.MIGRATED);
    expect(state!.files['file2.js'].status).toBe(FileStatus.PENDING);
  });

  it('should handle concurrent updates without corruption', async () => {
    await manager.initState('concurrent-test', ['a.js', 'b.js', 'c.js', 'd.js']);
    await Promise.all([
      manager.updateFileStatus('concurrent-test', 'a.js', FileStatus.MIGRATED),
      manager.updateFileStatus('concurrent-test', 'b.js', FileStatus.FAILED, 'err'),
      manager.updateFileStatus('concurrent-test', 'c.js', FileStatus.SKIPPED),
      manager.updateFileStatus('concurrent-test', 'd.js', FileStatus.IN_PROGRESS),
    ]);
    const state = await manager.getState('concurrent-test');
    expect(state!.files['a.js'].status).toBe(FileStatus.MIGRATED);
    expect(state!.files['b.js'].status).toBe(FileStatus.FAILED);
    expect(state!.files['c.js'].status).toBe(FileStatus.SKIPPED);
    expect(state!.files['d.js'].status).toBe(FileStatus.IN_PROGRESS);
  });

  it('should provide state query methods', async () => {
    await manager.initState('query-test', ['a.js', 'b.js', 'c.js']);
    await manager.updateFileStatus('query-test', 'a.js', FileStatus.MIGRATED);
    await manager.updateFileStatus('query-test', 'b.js', FileStatus.FAILED, 'err');

    const migrated = await manager.getFilesByStatus('query-test', FileStatus.MIGRATED);
    expect(migrated).toHaveLength(1);
    expect(migrated[0].path).toBe('a.js');

    const summary = await manager.getSummary('query-test');
    expect(summary.total).toBe(3);
    expect(summary.migrated).toBe(1);
    expect(summary.failed).toBe(1);

    const progress = await manager.getMigrationProgress('query-test');
    expect(progress).toBeCloseTo(33.33, 0);
  });
});
