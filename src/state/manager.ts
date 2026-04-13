import * as fs from 'node:fs';
import * as path from 'node:path';
import { FileStatus } from '../types/state';
import type { MigrationState, FileState } from '../types/state';

export class StateManager {
  private locks = new Map<string, Promise<void>>();

  constructor(private squadStateDir: string) {}

  private statePath(configName: string): string {
    return path.join(this.squadStateDir, `${configName}-migration-state.json`);
  }

  private async withLock<T>(configName: string, fn: () => Promise<T>): Promise<T> {
    const key = configName;
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolve!: () => void;
    const lockPromise = new Promise<void>(r => { resolve = r; });
    this.locks.set(key, lockPromise);
    try {
      return await fn();
    } finally {
      this.locks.delete(key);
      resolve();
    }
  }

  async getState(configName: string): Promise<MigrationState | null> {
    const filePath = this.statePath(configName);
    try {
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as MigrationState;
    } catch {
      return null;
    }
  }

  async saveState(state: MigrationState): Promise<void> {
    await this.withLock(state.configName, async () => {
      const filePath = this.statePath(state.configName);
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
      await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
    });
  }

  async initState(configName: string, files: string[]): Promise<MigrationState> {
    const fileStates: Record<string, FileState> = {};
    for (const f of files) {
      fileStates[f] = { path: f, status: FileStatus.PENDING };
    }
    const state: MigrationState = {
      configName,
      startedAt: Date.now(),
      files: fileStates,
      summary: { total: files.length, migrated: 0, failed: 0, skipped: 0, inProgress: 0 },
    };
    await this.saveState(state);
    return state;
  }

  async updateFileStatus(
    configName: string,
    filePath: string,
    status: FileStatus,
    error?: string
  ): Promise<void> {
    await this.withLock(configName, async () => {
      const state = await this.getState(configName);
      if (!state) throw new Error(`No state found for config: ${configName}`);
      if (!state.files[filePath]) {
        state.files[filePath] = { path: filePath, status: FileStatus.PENDING };
      }
      state.files[filePath].status = status;
      if (error) state.files[filePath].error = error;
      if (status === FileStatus.MIGRATED) state.files[filePath].completedAt = Date.now();
      state.summary = this.computeSummary(state);
      await this.saveStateRaw(state);
    });
  }

  async getFilesByStatus(configName: string, status: FileStatus): Promise<FileState[]> {
    const state = await this.getState(configName);
    if (!state) return [];
    return Object.values(state.files).filter(f => f.status === status);
  }

  async getSummary(configName: string): Promise<MigrationState['summary']> {
    const state = await this.getState(configName);
    if (!state) return { total: 0, migrated: 0, failed: 0, skipped: 0, inProgress: 0 };
    return this.computeSummary(state);
  }

  async getMigrationProgress(configName: string): Promise<number> {
    const summary = await this.getSummary(configName);
    if (summary.total === 0) return 0;
    return (summary.migrated / summary.total) * 100;
  }

  private computeSummary(state: MigrationState): MigrationState['summary'] {
    const files = Object.values(state.files);
    return {
      total: files.length,
      migrated: files.filter(f => f.status === FileStatus.MIGRATED).length,
      failed: files.filter(f => f.status === FileStatus.FAILED).length,
      skipped: files.filter(f => f.status === FileStatus.SKIPPED).length,
      inProgress: files.filter(f => f.status === FileStatus.IN_PROGRESS).length,
    };
  }

  private async saveStateRaw(state: MigrationState): Promise<void> {
    const filePath = this.statePath(state.configName);
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    await fs.promises.writeFile(filePath, JSON.stringify(state, null, 2), 'utf-8');
  }
}
