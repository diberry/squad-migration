import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Orchestrator } from '../../src/orchestrator';
import type { MigrationConfig } from '../../src/types/config';
import type { MigrationEvent } from '../../src/types/migration';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function makeConfig(): MigrationConfig {
  return {
    name: 'orch-test',
    source: { framework: 'express', pattern: 'src/**/*.js' },
    target: { framework: 'fastify', version: '4.0.0' },
    agents: {
      analyzer: { model: 'gpt-4o' },
      transformer: { model: 'gpt-4o' },
      tester: { model: 'gpt-4o-mini' },
      reviewer: { model: 'claude-3.5-sonnet' },
    },
    batching: { filesPerBatch: 10, parallelBatches: 2 },
    rollback: { onTestFailure: true },
    skills: [],
  };
}

describe('Orchestrator', () => {
  let tmpDir: string;
  let stateDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-test-'));
    stateDir = path.join(tmpDir, '.squad');
    fs.mkdirSync(stateDir, { recursive: true });
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'app.js'), 'const express = require("express");\n');
    fs.writeFileSync(path.join(srcDir, 'utils.js'), 'module.exports = {};\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should run full pipeline end-to-end', async () => {
    const orch = new Orchestrator(makeConfig(), stateDir);
    await orch.run(tmpDir);
    expect(orch.getPhase()).toBe('completed');
  });

  it('should emit lifecycle events', async () => {
    const orch = new Orchestrator(makeConfig(), stateDir);
    const events: MigrationEvent[] = [];
    orch.getEventBus().onAny(e => events.push(e));
    await orch.run(tmpDir);
    const types = events.map(e => e.type);
    expect(types).toContain('lifecycle-started');
    expect(types).toContain('lifecycle-analyzing');
    expect(types).toContain('lifecycle-planning');
    expect(types).toContain('lifecycle-executing');
    expect(types).toContain('lifecycle-completed');
  });

  it('should save migration state', async () => {
    const orch = new Orchestrator(makeConfig(), stateDir);
    await orch.run(tmpDir);
    const state = await orch.getStateManager().getState('orch-test');
    expect(state).not.toBeNull();
    expect(state!.summary.total).toBeGreaterThan(0);
  });

  it('should transition through phases', async () => {
    const orch = new Orchestrator(makeConfig(), stateDir);
    expect(orch.getPhase()).toBe('idle');
    await orch.run(tmpDir);
    expect(orch.getPhase()).toBe('completed');
  });
});
