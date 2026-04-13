import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TransformerAgent } from '../../src/agents/transformer';
import type { MigrationConfig } from '../../src/types/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function makeConfig(): MigrationConfig {
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
    batching: { filesPerBatch: 10, parallelBatches: 2 },
    rollback: { onTestFailure: true },
    skills: [],
  };
}

describe('TransformerAgent', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transformer-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should apply migration pattern to file', async () => {
    const filePath = path.join(tmpDir, 'app.js');
    fs.writeFileSync(filePath, 'const app = require("express");\napp.listen(3000);\n');
    const transformer = new TransformerAgent(makeConfig());
    const result = await transformer.transformFile(filePath);
    expect(result.success).toBe(true);
    expect(result.content).toContain('fastify');
    expect(result.content).not.toContain('"express"');
    expect(result.changeCount).toBeGreaterThan(0);
  });

  it('should return modified content and change metadata', async () => {
    const filePath = path.join(tmpDir, 'multi.js');
    fs.writeFileSync(filePath, 'require("express");\nrequire("express");\n');
    const transformer = new TransformerAgent(makeConfig());
    const result = await transformer.transformFile(filePath);
    expect(result.success).toBe(true);
    expect(result.changeCount).toBe(2);
  });

  it('should gracefully handle files that cannot be migrated', async () => {
    const transformer = new TransformerAgent(makeConfig());
    const result = await transformer.transformFile('/nonexistent/file.js');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle files with no framework references', async () => {
    const filePath = path.join(tmpDir, 'clean.js');
    fs.writeFileSync(filePath, 'const x = 42;\nconsole.log(x);\n');
    const transformer = new TransformerAgent(makeConfig());
    const result = await transformer.transformFile(filePath);
    expect(result.success).toBe(true);
    expect(result.changeCount).toBe(0);
  });
});
