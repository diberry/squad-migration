import { describe, it, expect } from 'vitest';
import { MigrationPlanner } from '../../src/planner';
import type { MigrationConfig } from '../../src/types/config';

function makeConfig(filesPerBatch = 3, parallelBatches = 2): MigrationConfig {
  return {
    name: 'test-migration',
    source: { framework: 'express', pattern: 'src/**/*.js' },
    target: { framework: 'fastify', version: '4.0.0' },
    agents: {
      analyzer: { model: 'gpt-4o' },
      transformer: { model: 'gpt-4o' },
      tester: { model: 'gpt-4o-mini' },
      reviewer: { model: 'claude-3.5-sonnet' },
    },
    batching: { filesPerBatch, parallelBatches },
    rollback: { onTestFailure: true },
    skills: [],
  };
}

describe('MigrationPlanner', () => {
  it('should create batches respecting filesPerBatch', () => {
    const planner = new MigrationPlanner(makeConfig(2));
    const files = ['a.js', 'b.js', 'c.js', 'd.js', 'e.js'];
    const batches = planner.createBatches(files, new Map());
    expect(batches.length).toBe(3); // 2, 2, 1
    expect(batches[0].files).toHaveLength(2);
    expect(batches[1].files).toHaveLength(2);
    expect(batches[2].files).toHaveLength(1);
  });

  it('should order files by dependency (shared modules first)', () => {
    const planner = new MigrationPlanner(makeConfig(10));
    const files = ['app.js', 'routes.js', 'utils.js'];
    const deps = new Map<string, string[]>();
    deps.set('app.js', ['utils.js']);
    deps.set('routes.js', ['app.js', 'utils.js']);
    deps.set('utils.js', []);

    const batches = planner.createBatches(files, deps);
    const sorted = batches[0].files;
    expect(sorted.indexOf('utils.js')).toBeLessThan(sorted.indexOf('app.js'));
    expect(sorted.indexOf('app.js')).toBeLessThan(sorted.indexOf('routes.js'));
  });

  it('should create batches with unique IDs and pending status', () => {
    const planner = new MigrationPlanner(makeConfig(2));
    const batches = planner.createBatches(['a.js', 'b.js', 'c.js'], new Map());
    const ids = batches.map(b => b.id);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    expect(batches.every(b => b.status === 'pending')).toBe(true);
  });

  it('should expose parallel batch limit', () => {
    const planner = new MigrationPlanner(makeConfig(5, 4));
    expect(planner.getParallelBatchLimit()).toBe(4);
  });

  it('should handle empty file list', () => {
    const planner = new MigrationPlanner(makeConfig(5));
    const batches = planner.createBatches([], new Map());
    expect(batches).toHaveLength(0);
  });
});
