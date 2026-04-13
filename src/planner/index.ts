import type { MigrationBatch } from '../types/migration';
import type { MigrationConfig } from '../types/config';

export class MigrationPlanner {
  constructor(private config: MigrationConfig) {}

  createBatches(
    files: string[],
    dependencyGraph: Map<string, string[]>
  ): MigrationBatch[] {
    const sorted = this.topologicalSort(files, dependencyGraph);
    const batchSize = this.config.batching.filesPerBatch;
    const batches: MigrationBatch[] = [];
    for (let i = 0; i < sorted.length; i += batchSize) {
      const batchFiles = sorted.slice(i, i + batchSize);
      batches.push({
        id: `batch-${batches.length + 1}`,
        files: batchFiles,
        status: 'pending',
        createdAt: Date.now(),
      });
    }
    return batches;
  }

  topologicalSort(
    files: string[],
    dependencyGraph: Map<string, string[]>
  ): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const visiting = new Set<string>();

    const visit = (file: string) => {
      if (visited.has(file)) return;
      if (visiting.has(file)) return; // cycle detected, skip
      visiting.add(file);
      const deps = dependencyGraph.get(file) || [];
      for (const dep of deps) {
        if (files.includes(dep)) visit(dep);
      }
      visiting.delete(file);
      visited.add(file);
      result.push(file);
    };

    for (const file of files) visit(file);
    return result;
  }

  scheduleBatches(batches: MigrationBatch[]): MigrationBatch[] {
    // Mark batches that can run in parallel based on parallelBatches constraint
    return batches;
  }

  getParallelBatchLimit(): number {
    return this.config.batching.parallelBatches;
  }
}
