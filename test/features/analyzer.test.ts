import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AnalyzerAgent } from '../../src/agents/analyzer';
import type { MigrationConfig } from '../../src/types/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function makeConfig(pattern = 'src/**/*.js'): MigrationConfig {
  return {
    name: 'test-migration',
    source: { framework: 'express', pattern },
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

describe('AnalyzerAgent', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'analyzer-test-'));
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'app.js'), 'const express = require("express");\nconst app = express();\n');
    fs.writeFileSync(path.join(srcDir, 'routes.js'), 'const app = require("./app");\nmodule.exports = app;\n');
    fs.writeFileSync(path.join(srcDir, 'utils.js'), '// small util\nmodule.exports = {};\n');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should produce file inventory matching source pattern', async () => {
    const analyzer = new AnalyzerAgent(makeConfig('src/**/*.js'));
    const files = await analyzer.getFileInventory(tmpDir);
    expect(files).toHaveLength(3);
    expect(files).toContain('src/app.js');
    expect(files).toContain('src/routes.js');
    expect(files).toContain('src/utils.js');
  });

  it('should estimate complexity per file', () => {
    const analyzer = new AnalyzerAgent(makeConfig());
    const small = path.join(tmpDir, 'src', 'utils.js');
    expect(analyzer.estimateComplexity(small)).toBe('easy');

    // Create a large file
    const bigContent = Array(350).fill('const x = require("express");\n').join('');
    const bigFile = path.join(tmpDir, 'src', 'big.js');
    fs.writeFileSync(bigFile, bigContent);
    expect(analyzer.estimateComplexity(bigFile)).toBe('hard');
  });

  it('should detect dependencies between files', async () => {
    const analyzer = new AnalyzerAgent(makeConfig('src/**/*.js'));
    const graph = await analyzer.buildDependencyGraph(tmpDir);
    expect(graph.has('src/routes.js')).toBe(true);
    const routeDeps = graph.get('src/routes.js') || [];
    expect(routeDeps).toContain('src/app.js');
  });

  it('should produce deterministic output', async () => {
    const analyzer = new AnalyzerAgent(makeConfig('src/**/*.js'));
    const files1 = await analyzer.getFileInventory(tmpDir);
    const files2 = await analyzer.getFileInventory(tmpDir);
    expect(files1).toEqual(files2);
  });

  it('should produce full analysis', async () => {
    const analyzer = new AnalyzerAgent(makeConfig('src/**/*.js'));
    const analysis = await analyzer.analyze(tmpDir);
    expect(analysis.filesCount).toBe(3);
    expect(analysis.complexityBreakdown.easy + analysis.complexityBreakdown.medium + analysis.complexityBreakdown.hard).toBe(3);
    expect(analysis.dependencies.size).toBeGreaterThan(0);
  });
});
