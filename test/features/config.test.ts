import { describe, it, expect } from 'vitest';
import type { MigrationConfig } from '../../src/types/config';
import { validateMigrationConfig, loadMigrationConfig, getValidationErrors, ConfigValidationError } from '../../src/config/loader';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

function validConfig(): MigrationConfig {
  return {
    name: 'express-to-fastify',
    source: { framework: 'express', pattern: 'src/**/*.js' },
    target: { framework: 'fastify', version: '4.0.0' },
    agents: {
      analyzer: { model: 'gpt-4o' },
      transformer: { model: 'gpt-4o' },
      tester: { model: 'gpt-4o-mini' },
      reviewer: { model: 'claude-3.5-sonnet' },
    },
    batching: { filesPerBatch: 10, parallelBatches: 3 },
    rollback: { onTestFailure: true },
    skills: ['express-migration'],
  };
}

describe('MigrationConfig', () => {
  it('should load and validate required fields', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
    const configPath = path.join(tmpDir, 'migration.json');
    fs.writeFileSync(configPath, JSON.stringify(validConfig()));
    try {
      const config = await loadMigrationConfig(configPath);
      expect(config.name).toBe('express-to-fastify');
      expect(config.source.framework).toBe('express');
      expect(config.target.framework).toBe('fastify');
      expect(config.batching.filesPerBatch).toBe(10);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it('should reject invalid agent models', () => {
    const config = validConfig() as any;
    config.agents.analyzer.model = 'invalid-model-xyz';
    expect(validateMigrationConfig(config)).toBe(false);
    const errors = getValidationErrors(config);
    expect(errors.some(e => e.includes('not a valid model'))).toBe(true);
  });

  it('should validate source/target patterns are valid globs', () => {
    const config = validConfig() as any;
    expect(validateMigrationConfig(config)).toBe(true);

    config.source.pattern = '[invalid';
    expect(validateMigrationConfig(config)).toBe(false);
    const errors = getValidationErrors(config);
    expect(errors.some(e => e.includes('glob'))).toBe(true);
  });

  it('should enforce batch size constraints', () => {
    const tooSmall = validConfig() as any;
    tooSmall.batching.filesPerBatch = 0;
    expect(validateMigrationConfig(tooSmall)).toBe(false);

    const tooLarge = validConfig() as any;
    tooLarge.batching.filesPerBatch = 101;
    expect(validateMigrationConfig(tooLarge)).toBe(false);

    const justRight = validConfig() as any;
    justRight.batching.filesPerBatch = 50;
    expect(validateMigrationConfig(justRight)).toBe(true);
  });

  it('should reject configs missing required fields', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
    const configPath = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(configPath, JSON.stringify({ name: 'incomplete' }));
    try {
      await expect(loadMigrationConfig(configPath)).rejects.toThrow(ConfigValidationError);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
