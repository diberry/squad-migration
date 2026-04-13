// Configuration types for migration tool

export interface AgentConfig {
  model: string;
}

export interface BatchingConfig {
  filesPerBatch: number;
  parallelBatches: number;
}

export interface SourceConfig {
  framework: string;
  pattern: string;
}

export interface TargetConfig {
  framework: string;
  version: string;
}

export interface MigrationConfig {
  name: string;
  source: SourceConfig;
  target: TargetConfig;
  agents: {
    analyzer: AgentConfig;
    transformer: AgentConfig;
    tester: AgentConfig;
    reviewer: AgentConfig;
  };
  batching: BatchingConfig;
  rollback: {
    onTestFailure: boolean;
  };
  skills: string[];
}
