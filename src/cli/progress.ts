export interface ProgressData {
  current: number;
  total: number;
  failed: number;
  skipped: number;
  batchStatus: string;
  estimatedTimeRemaining?: number;
}

export class ProgressDisplay {
  private startTime: number = Date.now();
  private output: string[] = [];

  updateProgress(current: number, total: number, failed: number): void {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    const elapsed = Date.now() - this.startTime;
    const rate = current > 0 ? elapsed / current : 0;
    const remaining = rate > 0 ? Math.round(rate * (total - current)) : 0;
    const bar = this.renderBar(pct);
    const line = `${bar} ${current}/${total} (${pct}%) | Failed: ${failed} | ETA: ${this.formatMs(remaining)}`;
    this.output.push(line);
  }

  displayReport(summary: {
    migrated: number;
    failed: number;
    skipped: number;
    duration: number;
  }): string {
    const lines = [
      '═══ Migration Complete ═══',
      `  Migrated: ${summary.migrated}`,
      `  Failed:   ${summary.failed}`,
      `  Skipped:  ${summary.skipped}`,
      `  Duration: ${this.formatMs(summary.duration)}`,
      '══════════════════════════',
    ];
    const report = lines.join('\n');
    this.output.push(report);
    return report;
  }

  getOutput(): string[] {
    return [...this.output];
  }

  reset(): void {
    this.startTime = Date.now();
    this.output = [];
  }

  private renderBar(pct: number): string {
    const filled = Math.round(pct / 5);
    const empty = 20 - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  private formatMs(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const secs = Math.round(ms / 1000);
    if (secs < 60) return `${secs}s`;
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}m ${rem}s`;
  }
}
