import type { MigrationConfig } from '../types/config';
import type { MigrationAnalysis } from '../types/migration';
import { StateManager } from '../state/manager';
import { MigrationEventBus } from '../events/bus';
import { AnalyzerAgent } from '../agents/analyzer';
import { MigrationPlanner } from '../planner';
import { BatchExecutor } from '../executor';
import { ProgressDisplay } from '../cli/progress';

export type OrchestratorPhase = 'idle' | 'analyzing' | 'planning' | 'executing' | 'reporting' | 'completed' | 'failed';

export class Orchestrator {
  private stateManager: StateManager;
  private eventBus: MigrationEventBus;
  private progressDisplay: ProgressDisplay;
  private phase: OrchestratorPhase = 'idle';
  private analysis: MigrationAnalysis | null = null;

  constructor(
    private config: MigrationConfig,
    squadStateDir: string
  ) {
    this.stateManager = new StateManager(squadStateDir);
    this.eventBus = new MigrationEventBus();
    this.progressDisplay = new ProgressDisplay();
  }

  async run(codebasePath: string): Promise<void> {
    try {
      this.emitLifecycle('started');

      this.phase = 'analyzing';
      this.emitLifecycle('analyzing');
      this.analysis = await this.analyzeCodebase(codebasePath);

      this.phase = 'planning';
      this.emitLifecycle('planning');
      const planner = new MigrationPlanner(this.config);
      const batches = planner.createBatches(
        Array.from(this.analysis.dependencies.keys()),
        this.analysis.dependencies
      );

      // Init state
      const files = batches.flatMap(b => b.files);
      await this.stateManager.initState(this.config.name, files);

      this.phase = 'executing';
      this.emitLifecycle('executing');
      const executor = new BatchExecutor(this.config, this.stateManager, this.eventBus);
      await executor.executeBatches(batches);

      this.phase = 'reporting';
      this.emitLifecycle('reporting');
      await this.generateReport();

      this.phase = 'completed';
      this.emitLifecycle('completed');
    } catch (err: any) {
      this.phase = 'failed';
      this.emitLifecycle('failed');
      throw err;
    }
  }

  getPhase(): OrchestratorPhase { return this.phase; }
  getEventBus(): MigrationEventBus { return this.eventBus; }
  getStateManager(): StateManager { return this.stateManager; }
  getProgressDisplay(): ProgressDisplay { return this.progressDisplay; }

  private async analyzeCodebase(codebasePath: string): Promise<MigrationAnalysis> {
    const analyzer = new AnalyzerAgent(this.config);
    return analyzer.analyze(codebasePath);
  }

  private async generateReport(): Promise<string> {
    const summary = await this.stateManager.getSummary(this.config.name);
    return this.progressDisplay.displayReport({
      migrated: summary.migrated,
      failed: summary.failed,
      skipped: summary.skipped,
      duration: Date.now(),
    });
  }

  private emitLifecycle(phase: string): void {
    this.eventBus.emit({ type: `lifecycle-${phase}`, timestamp: Date.now() });
  }
}
