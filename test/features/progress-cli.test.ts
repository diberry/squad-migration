import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressDisplay } from '../../src/cli/progress';

describe('ProgressCLI', () => {
  let display: ProgressDisplay;

  beforeEach(() => {
    display = new ProgressDisplay();
  });

  it('should display X/Y files migrated', () => {
    display.updateProgress(5, 20, 1);
    const output = display.getOutput();
    expect(output.length).toBe(1);
    expect(output[0]).toContain('5/20');
    expect(output[0]).toContain('25%');
    expect(output[0]).toContain('Failed: 1');
  });

  it('should refresh progress on updates', () => {
    display.updateProgress(1, 10, 0);
    display.updateProgress(5, 10, 0);
    display.updateProgress(10, 10, 0);
    const output = display.getOutput();
    expect(output).toHaveLength(3);
    expect(output[2]).toContain('100%');
  });

  it('should show batch status in report', () => {
    const report = display.displayReport({
      migrated: 8,
      failed: 1,
      skipped: 1,
      duration: 65000,
    });
    expect(report).toContain('Migrated: 8');
    expect(report).toContain('Failed:   1');
    expect(report).toContain('Skipped:  1');
    expect(report).toContain('1m');
  });

  it('should show progress bar', () => {
    display.updateProgress(10, 20, 0);
    const output = display.getOutput();
    expect(output[0]).toContain('█');
    expect(output[0]).toContain('░');
  });

  it('should handle zero total gracefully', () => {
    display.updateProgress(0, 0, 0);
    const output = display.getOutput();
    expect(output[0]).toContain('0%');
  });
});
