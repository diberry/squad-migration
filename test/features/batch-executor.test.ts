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
    name: 'batch-test',
    source: { framework: 'express', pattern: 'src/**/*.js' },
    target: { framework: 'fastify', version: '4.0.0' },
    agents: {
      analyzer: { model: 'gpt-4o' },
      transformer: { model: 'gpt-4o' },
      tester: { model: 'gpt-4o-mini' },
      reviewer: { model: 'claude-3.5-sonnet' },
    },
    batching: { filesPerBatch: 5, parallelBatches: 2 },
    rollback: { onTestFailure: true },
    skills: [],
  };
}

describe('BatchExecutor', () => {
  let tmpDir: string;
  let stateDir: string;
  let stateManager: StateManager;
  let eventBus: MigrationEventBus;
  let config: MigrationConfig;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-test-'));
    stateDir = path.join(tmpDir, '.squad');
    fs.mkdirSync(stateDir, { recursive: true });
    stateManager = new StateManager(stateDir);
    eventBus = new MigrationEventBus();
    config = makeConfig();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should execute batches and emit events', async () => {
    const file1 = path.join(tmpDir, 'a.js');
    const file2 = path.join(tmpDir, 'b.js');
    fs.writeFileSync(file1, 'const express = require("express");\n');
    fs.writeFileSync(file2, 'const express = require("express");\n');

    await stateManager.initState('batch-test', [file1, file2]);
    const batch: MigrationBatch = {
      id: 'batch-1',
      files: [file1, file2],
      status: 'pending',
      createdAt: Date.now(),
    };

    const events: MigrationEvent[] = [];
    eventBus.onAny(e => events.push(e));

    const executor = new BatchExecutor(config, stateManager, eventBus);
    await executor.executeBatches([batch]);

    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toContain('batch-started');
    expect(eventTypes).toContain('file-started');
    expect(eventTypes).toContain('file-completed');
    expect(eventTypes).toContain('batch-completed');
    expect(eventTypes).toContain('migration-completed');
  });

  it('should track progress in state', async () => {
    const file = path.join(tmpDir, 'c.js');
    fs.writeFileSync(file, 'require("express");\n');
    await stateManager.initState('batch-test', [file]);

    const batch: MigrationBatch = {
      id: 'batch-1',
      files: [file],
      status: 'pending',
      createdAt: Date.now(),
    };

    const executor = new BatchExecutor(config, stateManager, eventBus);
    await executor.executeBatches([batch]);

    const migrated = await stateManager.getFilesByStatus('batch-test', FileStatus.MIGRATED);
    expect(migrated).toHaveLength(1);
  });

  it('should transform file contents', async () => {
    const file = path.join(tmpDir, 'd.js');
    fs.writeFileSync(file, 'const express = require("express");\n');
    await stateManager.initState('batch-test', [file]);

    const batch: MigrationBatch = {
      id: 'batch-1',
      files: [file],
      status: 'pending',
      createdAt: Date.now(),
    };

    const executor = new BatchExecutor(config, stateManager, eventBus);
    await executor.executeBatches([batch]);

    const content = fs.readFileSync(file, 'utf-8');
    expect(content).toContain('fastify');
  });
});
