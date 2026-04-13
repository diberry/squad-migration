import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../src/state/manager';
import { FileStatus } from '../../src/types/state';
import { ProgressDisplay } from '../../src/cli/progress';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('StatusReporter', () => {
  let tmpDir: string;
  let stateManager: StateManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reporter-test-'));
    stateManager = new StateManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should generate final summary', async () => {
    await stateManager.initState('report-cfg', ['a.js', 'b.js', 'c.js']);
    await stateManager.updateFileStatus('report-cfg', 'a.js', FileStatus.MIGRATED);
    await stateManager.updateFileStatus('report-cfg', 'b.js', FileStatus.FAILED, 'parse error');
    await stateManager.updateFileStatus('report-cfg', 'c.js', FileStatus.SKIPPED);

    const summary = await stateManager.getSummary('report-cfg');
    expect(summary.migrated).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.skipped).toBe(1);
  });

  it('should include per-file status and error reasons', async () => {
    await stateManager.initState('report-cfg', ['x.js']);
    await stateManager.updateFileStatus('report-cfg', 'x.js', FileStatus.FAILED, 'syntax error line 5');

    const failed = await stateManager.getFilesByStatus('report-cfg', FileStatus.FAILED);
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toBe('syntax error line 5');
  });

  it('should show progress percentage', async () => {
    await stateManager.initState('report-cfg', ['a.js', 'b.js', 'c.js', 'd.js']);
    await stateManager.updateFileStatus('report-cfg', 'a.js', FileStatus.MIGRATED);
    await stateManager.updateFileStatus('report-cfg', 'b.js', FileStatus.MIGRATED);

    const progress = await stateManager.getMigrationProgress('report-cfg');
    expect(progress).toBe(50);
  });

  it('should render report with display', async () => {
    await stateManager.initState('report-cfg', ['a.js', 'b.js']);
    await stateManager.updateFileStatus('report-cfg', 'a.js', FileStatus.MIGRATED);
    await stateManager.updateFileStatus('report-cfg', 'b.js', FileStatus.FAILED, 'err');

    const summary = await stateManager.getSummary('report-cfg');
    const display = new ProgressDisplay();
    const report = display.displayReport({
      migrated: summary.migrated,
      failed: summary.failed,
      skipped: summary.skipped,
      duration: 10000,
    });
    expect(report).toContain('Migrated: 1');
    expect(report).toContain('Failed:   1');
  });
});
