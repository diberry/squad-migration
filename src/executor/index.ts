import type { MigrationBatch } from '../types/migration';
import type { MigrationConfig } from '../types/config';
import { StateManager } from '../state/manager';
import { MigrationEventBus } from '../events/bus';
import { TransformerAgent } from '../agents/transformer';
import { TesterAgent, type TestResult } from '../agents/tester';
import { FileStatus } from '../types/state';
import * as fs from 'node:fs';

export class BatchExecutor {
  private transformer: TransformerAgent;
  private tester: TesterAgent;

  constructor(
    private config: MigrationConfig,
    private stateManager: StateManager,
    private eventBus: MigrationEventBus
  ) {
    this.transformer = new TransformerAgent(config);
    this.tester = new TesterAgent();
  }

  async executeBatches(batches: MigrationBatch[]): Promise<void> {
    const parallelLimit = this.config.batching.parallelBatches;
    for (let i = 0; i < batches.length; i += parallelLimit) {
      const chunk = batches.slice(i, i + parallelLimit);
      const results = await Promise.all(chunk.map(b => this.executeSingleBatch(b)));
      const failed = results.some(r => !r);
      if (failed) {
        this.eventBus.emit({ type: 'migration-halted', timestamp: Date.now() });
        return;
      }
    }
    this.eventBus.emit({ type: 'migration-completed', timestamp: Date.now() });
  }

  private async executeSingleBatch(batch: MigrationBatch): Promise<boolean> {
    batch.status = 'in-progress';
    this.eventBus.emit({ type: 'batch-started', batchId: batch.id, timestamp: Date.now() });
    const backups = new Map<string, string>();

    for (const file of batch.files) {
      this.eventBus.emit({ type: 'file-started', filePath: file, batchId: batch.id, timestamp: Date.now() });
      await this.stateManager.updateFileStatus(this.config.name, file, FileStatus.IN_PROGRESS);

      // Backup
      try { backups.set(file, await fs.promises.readFile(file, 'utf-8')); } catch { /* new file */ }

      const result = await this.transformer.transformFile(file);
      if (!result.success) {
        await this.stateManager.updateFileStatus(this.config.name, file, FileStatus.FAILED, result.error);
        this.eventBus.emit({ type: 'file-completed', filePath: file, status: 'failed', error: result.error, timestamp: Date.now() });
        await this.rollbackBatch(batch, backups);
        return false;
      }

      if (result.content) {
        await fs.promises.writeFile(file, result.content, 'utf-8');
      }
      await this.stateManager.updateFileStatus(this.config.name, file, FileStatus.MIGRATED);
      this.eventBus.emit({ type: 'file-completed', filePath: file, status: 'migrated', timestamp: Date.now() });
    }

    // Run tests
    const testResult = await this.tester.testBatch(batch);
    if (!testResult.passed) {
      await this.rollbackBatch(batch, backups);
      for (const file of batch.files) {
        await this.stateManager.updateFileStatus(this.config.name, file, FileStatus.FAILED, 'Test failed');
      }
      return false;
    }

    batch.status = 'completed';
    this.eventBus.emit({ type: 'batch-completed', batchId: batch.id, timestamp: Date.now() });
    return true;
  }

  private async rollbackBatch(batch: MigrationBatch, backups: Map<string, string>): Promise<void> {
    batch.status = 'failed';
    for (const [file, content] of backups) {
      try { await fs.promises.writeFile(file, content, 'utf-8'); } catch { /* ignore */ }
    }
    this.eventBus.emit({ type: 'batch-rollback', batchId: batch.id, timestamp: Date.now() });
  }

  private async commitBatch(batch: MigrationBatch): Promise<void> {
    batch.status = 'completed';
  }
}
