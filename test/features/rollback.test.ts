import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BatchExecutor } from '../../src/executor';
import { StateManager } from '../../src/state/manager';
import { MigrationEventBus } from '../../src/events/bus';
import { FileStatus } from '../../src/types/state';
import type { MigrationConfig } from '../../src/types/config';
import type { MigrationBatch, MigrationEvent } from '../../src/types/migration';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function makeConfig(): MigrationConfig {
  return {
    name: 'rollback-test',
    source: { framework: 'express', pattern: 'src/**/*.js' },
    target: { framework: 'fastify', version: '4.0.0' },
    agents: {
      analyzer: { model: 'gpt-4o' },
      transformer: { model: 'gpt-4o' },
      tester: { model: 'gpt-4o-mini' },
      reviewer: { model: 'claude-3.5-sonnet' },
    },
    batching: { filesPerBatch: 5, parallelBatches: 1 },
    rollback: { onTestFailure: true },
    skills: [],
  };
}

describe('Rollback', () => {
  let tmpDir: string;
  let stateDir: string;
  let stateManager: StateManager;
  let eventBus: MigrationEventBus;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rollback-test-'));
    stateDir = path.join(tmpDir, '.squad');
    fs.mkdirSync(stateDir, { recursive: true });
    stateManager = new StateManager(stateDir);
    eventBus = new MigrationEventBus();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should rollback on transformer error and restore files', async () => {
    const goodFile = path.join(tmpDir, 'good.js');
    const badFile = path.join(tmpDir, 'bad.js'); // doesn't exist = transformer error
    fs.writeFileSync(goodFile, 'require("express");\n');

    await stateManager.initState('rollback-test', [goodFile, badFile]);
    const batch: MigrationBatch = {
      id: 'batch-1',
      files: [goodFile, badFile],
      status: 'pending',
      createdAt: Date.now(),
    };

    const events: MigrationEvent[] = [];
    eventBus.onAny(e => events.push(e));

    const executor = new BatchExecutor(makeConfig(), stateManager, eventBus);
    await executor.executeBatches([batch]);

    // The good file should be rolled back to original content
    const content = fs.readFileSync(goodFile, 'utf-8');
    expect(content).toContain('express');
    expect(content).not.toContain('fastify');

    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toContain('batch-rollback');
  });

  it('should mark failed files in state', async () => {
    const badFile = path.join(tmpDir, 'missing.js');
    await stateManager.initState('rollback-test', [badFile]);

    const batch: MigrationBatch = {
      id: 'batch-1',
      files: [badFile],
      status: 'pending',
      createdAt: Date.now(),
    };

    const executor = new BatchExecutor(makeConfig(), stateManager, eventBus);
    await executor.executeBatches([batch]);

    const failed = await stateManager.getFilesByStatus('rollback-test', FileStatus.FAILED);
    expect(failed.length).toBeGreaterThanOrEqual(1);
  });

  it('should not affect previously successful batches', async () => {
    const file1 = path.join(tmpDir, 'ok.js');
    const badFile = path.join(tmpDir, 'nope.js');
    fs.writeFileSync(file1, 'require("express");\n');

    await stateManager.initState('rollback-test', [file1, badFile]);

    const batch1: MigrationBatch = {
      id: 'batch-1',
      files: [file1],
      status: 'pending',
      createdAt: Date.now(),
    };
    const batch2: MigrationBatch = {
      id: 'batch-2',
      files: [badFile],
      status: 'pending',
      createdAt: Date.now(),
    };

    const executor = new BatchExecutor(makeConfig(), stateManager, eventBus);
    await executor.executeBatches([batch1, batch2]);

    // batch1 should have succeeded
    const migrated = await stateManager.getFilesByStatus('rollback-test', FileStatus.MIGRATED);
    expect(migrated.some(f => f.path === file1)).toBe(true);
  });
});
