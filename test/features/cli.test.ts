import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '..', '..');
const CLI = path.join(ROOT, 'dist', 'cli', 'main.js');

function run(args: string, cwd?: string): { stdout: string; exitCode: number } {
  try {
    const stdout = execSync(`node "${CLI}" ${args}`, {
      cwd: cwd || ROOT,
      encoding: 'utf-8',
      timeout: 15000,
    });
    return { stdout, exitCode: 0 };
  } catch (err: any) {
    return { stdout: (err.stdout || '') + (err.stderr || ''), exitCode: err.status ?? 1 };
  }
}

describe('CLI: squad-migrate', () => {
  it('shows help with no arguments', () => {
    const { stdout, exitCode } = run('');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('squad-migrate');
    expect(stdout).toContain('init');
    expect(stdout).toContain('analyze');
    expect(stdout).toContain('run');
    expect(stdout).toContain('status');
    expect(stdout).toContain('rollback');
  });

  it('shows help with --help', () => {
    const { stdout, exitCode } = run('--help');
    expect(exitCode).toBe(0);
    expect(stdout).toContain('squad-migrate');
  });

  it('errors on unknown command', () => {
    const { stdout, exitCode } = run('foobar');
    expect(exitCode).toBe(1);
    expect(stdout).toContain('Unknown command');
  });

  describe('init', () => {
    const tmpDir = path.join(ROOT, 'test-tmp-init');
    beforeEach(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('creates a sample migration.json', () => {
      const configPath = path.join(tmpDir, 'migration.json');
      const { stdout, exitCode } = run(`init --config "${configPath}"`);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Created sample config');
      expect(fs.existsSync(configPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(content.name).toBe('express-to-fastify');
      expect(content.agents.analyzer.model).toBeTruthy();
    });

    it('refuses to overwrite existing file', () => {
      const configPath = path.join(tmpDir, 'migration.json');
      fs.writeFileSync(configPath, '{}');
      const { stdout, exitCode } = run(`init --config "${configPath}"`);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('already exists');
    });
  });

  describe('status with no state', () => {
    const tmpDir = path.join(ROOT, 'test-tmp-status');
    beforeEach(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('reports no state found', () => {
      const configPath = path.join(ROOT, 'examples', 'migration.json');
      const { stdout, exitCode } = run(`status --config "${configPath}"`, tmpDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('No migration state found');
    });
  });

  describe('rollback with no state', () => {
    const tmpDir = path.join(ROOT, 'test-tmp-rollback');
    beforeEach(() => { fs.mkdirSync(tmpDir, { recursive: true }); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('reports nothing to rollback', () => {
      const configPath = path.join(ROOT, 'examples', 'migration.json');
      const { stdout, exitCode } = run(`rollback --config "${configPath}"`, tmpDir);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Nothing to rollback');
    });
  });
});
