// Core migration types and interfaces

export interface MigrationAnalysis {
  filesCount: number;
  complexityBreakdown: {
    easy: number;
    medium: number;
    hard: number;
  };
  dependencies: Map<string, string[]>;
}

export interface MigrationBatch {
  id: string;
  files: string[];
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  createdAt: number;
}

export interface TransformResult {
  filePath: string;
  success: boolean;
  content?: string;
  error?: string;
  changeCount?: number;
}

export interface MigrationEvent {
  type: string;
  filePath?: string;
  batchId?: string;
  status?: string;
  error?: string;
  timestamp: number;
}
