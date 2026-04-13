import { describe, it, expect } from 'vitest';
import { ProgressDisplay } from '../../src/cli/progress';

describe('MigrationReport', () => {
  it('should render human-readable summary', () => {
    const display = new ProgressDisplay();
    const report = display.displayReport({
      migrated: 45,
      failed: 3,
      skipped: 2,
      duration: 120000,
    });
    expect(report).toContain('Migration Complete');
    expect(report).toContain('Migrated: 45');
    expect(report).toContain('Failed:   3');
    expect(report).toContain('Skipped:  2');
  });

  it('should include duration in report', () => {
    const display = new ProgressDisplay();
    const report = display.displayReport({
      migrated: 10,
      failed: 0,
      skipped: 0,
      duration: 5000,
    });
    expect(report).toContain('Duration');
    expect(report).toContain('5s');
  });

  it('should format large durations', () => {
    const display = new ProgressDisplay();
    const report = display.displayReport({
      migrated: 100,
      failed: 5,
      skipped: 10,
      duration: 3661000,
    });
    expect(report).toContain('m');
  });
});
