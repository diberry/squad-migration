import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TesterAgent } from '../../src/agents/tester';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('TesterAgent', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tester-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should detect vitest framework', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      devDependencies: { vitest: '^1.0.0' },
    }));
    const tester = new TesterAgent();
    const framework = await tester.detectTestFramework(tmpDir);
    expect(framework).toBe('vitest');
  });

  it('should detect jest framework', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      devDependencies: { jest: '^29.0.0' },
    }));
    const tester = new TesterAgent();
    const framework = await tester.detectTestFramework(tmpDir);
    expect(framework).toBe('jest');
  });

  it('should detect mocha framework', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      devDependencies: { mocha: '^10.0.0' },
    }));
    const tester = new TesterAgent();
    const framework = await tester.detectTestFramework(tmpDir);
    expect(framework).toBe('mocha');
  });

  it('should return unknown for no framework', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      devDependencies: {},
    }));
    const tester = new TesterAgent();
    const framework = await tester.detectTestFramework(tmpDir);
    expect(framework).toBe('unknown');
  });

  it('should run tests for a batch', async () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
      devDependencies: { vitest: '^1.0.0' },
    }));
    const tester = new TesterAgent();
    const result = await tester.testBatch({
      id: 'b1',
      files: ['a.js'],
      status: 'in-progress',
      createdAt: Date.now(),
    }, tmpDir);
    expect(result.passed).toBe(true);
    expect(result.testFramework).toBe('vitest');
  });
});
