import type { MigrationBatch } from '../../types/migration';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface TestResult {
  passed: boolean;
  failureDetails?: string;
  coverage?: number;
  testFramework?: string;
  simulated?: boolean;
}

export interface TesterOptions {
  /** Shell command to run tests (e.g. "npm test"). When not set, falls back to simulated mode. */
  testCommand?: string;
}

export class TesterAgent {
  private options: TesterOptions;

  constructor(options: TesterOptions = {}) {
    this.options = options;
  }

  async testBatch(batch: MigrationBatch, codebasePath?: string): Promise<TestResult> {
    try {
      const resolvedPath = codebasePath || '.';
      const framework = await this.detectTestFramework(resolvedPath);
      return await this.runTests(framework, resolvedPath);
    } catch (err: any) {
      return { passed: false, failureDetails: err.message };
    }
  }

  async detectTestFramework(codebasePath: string): Promise<string> {
    try {
      const pkgPath = path.join(codebasePath, 'package.json');
      const raw = await fs.promises.readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw);
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (allDeps.vitest) return 'vitest';
      if (allDeps.jest) return 'jest';
      if (allDeps.mocha) return 'mocha';
    } catch { /* ignore */ }
    return 'unknown';
  }

  private async runTests(framework: string, codebasePath: string): Promise<TestResult> {
    const command = this.options.testCommand;

    if (!command) {
      // No test command configured — fall back to simulated mode
      return { passed: true, testFramework: framework, simulated: true };
    }

    try {
      const [cmd, ...args] = command.split(' ');
      await execFileAsync(cmd, args, { cwd: codebasePath });
      return { passed: true, testFramework: framework, simulated: false };
    } catch (err: any) {
      return {
        passed: false,
        testFramework: framework,
        simulated: false,
        failureDetails: err.stderr || err.message || 'Test command failed',
      };
    }
  }
}
