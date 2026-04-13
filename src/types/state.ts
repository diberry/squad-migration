// State types for tracking migration progress

export enum FileStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  MIGRATED = 'migrated',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface FileState {
  path: string;
  status: FileStatus;
  complexity?: 'easy' | 'medium' | 'hard';
  error?: string;
  batchId?: string;
  completedAt?: number;
}

export interface MigrationState {
  configName: string;
  startedAt: number;
  files: Record<string, FileState>;
  summary: {
    total: number;
    migrated: number;
    failed: number;
    skipped: number;
    inProgress: number;
  };
}
