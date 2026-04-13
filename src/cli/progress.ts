// Progress CLI display

/**
 * Real-time progress display for migration execution
 */
export class ProgressDisplay {
  /**
   * Update progress display
   */
  updateProgress(current: number, total: number, failed: number): void {
    // TODO: Display progress bar and metrics
    throw new Error('Not implemented');
  }

  /**
   * Display final report
   */
  displayReport(summary: {
    migrated: number;
    failed: number;
    skipped: number;
    duration: number;
  }): void {
    // TODO: Display completion summary
    throw new Error('Not implemented');
  }
}
