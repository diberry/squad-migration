# Squad SDK Example: Code Migration Framework

Orchestrate large-scale code migrations using **Squad SDK** agents that work in parallel: analyze dependencies, transform files in batches, validate with automated tests, and safely rollback on failure. Built for framework upgrades, dependency migrations, and bulk codemod operations.

## Using This Example

### Install

```bash
git clone https://github.com/bradygaster/squad-sdk-example-migration.git
cd project-squad-sdk-example-migration
npm install && npm run build
npm link   # makes `squad-migrate` available globally
```

### CLI Commands

All commands use the `squad-migrate` CLI:

```bash
squad-migrate init [--config path]      # Create a sample migration.json
squad-migrate analyze --config path     # Analyze source files (dry-run)
squad-migrate run --config path         # Execute migration batches
squad-migrate status --config path      # Show per-file migration status
squad-migrate rollback --config path    # Rollback last migration
```

If you haven't run `npm link`, use `node dist/cli/main.js` instead of `squad-migrate`.

### Quick Start

```bash
# 1. Generate a sample config
squad-migrate init --config migration.json

# 2. Edit migration.json for your project (source pattern, target framework, etc.)

# 3. Analyze your codebase (dry-run, no changes)
squad-migrate analyze --config migration.json

# 4. Run the migration
squad-migrate run --config migration.json

# 5. Check progress
squad-migrate status --config migration.json

# 6. Rollback if needed
squad-migrate rollback --config migration.json
```

### Migration Config

The `squad-migrate init` command creates a sample `migration.json`. Key fields:

| Field | Purpose |
|-------|---------|
| `name` | Migration identifier |
| `source.framework` | Source framework (e.g., `express`) |
| `source.pattern` | Glob for files to migrate (e.g., `src/**/*.ts`) |
| `target.framework` | Target framework (e.g., `fastify`) |
| `target.version` | Target version |
| `agents.*` | AI model for each phase (analyzer, transformer, tester, reviewer) |
| `batching.filesPerBatch` | Files per batch (1–100) |
| `batching.parallelBatches` | Concurrent batch limit |
| `rollback.onTestFailure` | Auto-revert on test failure |

See [`examples/migration.json`](./examples/migration.json) for a complete sample.

### Expected Output

```
🚀 Migration: express-to-fastify
   Analyzed 42 files
   Created 9 batches
   ✅ batch-1 completed
   ✅ batch-2 completed

═══ Migration Complete ═══
  Migrated: 40
  Failed:   1
  Skipped:  1
  Duration: 22m 30s
══════════════════════════
```

## Extending This Example

### Programmatic API

Use Squad SDK agents directly in TypeScript:

```typescript
import { MigrationOrchestrator } from './orchestrator';
import { loadConfig } from './config/loader';

const config = loadConfig('./migration.json');
const orchestrator = new MigrationOrchestrator(config);

orchestrator.on('batch-completed', (batch) => {
  console.log(`Batch ${batch.id} done: ${batch.files.length} files`);
});

await orchestrator.execute('/path/to/codebase');
```

### Architecture Overview

```
┌─────────────────────────────────────────┐
│ MigrationOrchestrator (src/orchestrator)│  ◄── Main coordinator
└────────┬────────────────────────────────┘
         │
    ┌────┴─────┬──────────────┬─────────────┐
    ▼          ▼              ▼             ▼
┌────────┐ ┌────────┐    ┌─────────┐  ┌────────┐
│Analyzer│ │Planner │    │Executor │  │Reporter│  ◄── Stage managers
└───┬────┘ └───┬────┘    └────┬────┘  └───┬────┘
    │          │              │           │
    ▼          ▼              ▼           ▼
┌─────────────────────────────────────────────────┐
│ Squad SDK: EventBus, State, SkillRegistry      │  ◄── SDK Foundation
│ (src/events, src/state, src/skills)            │
└─────────────────────────────────────────────────┘
```

**Key components:**
- **Analyzer** (`src/agents/analyzer/`) — Scans files, detects imports, builds dependency graph
- **Planner** (`src/planner/`) — Groups files into parallel-safe batches using topological sort
- **Executor** (`src/executor/`) — Runs batches, spawns transformer agents, validates with tests
- **Reporter** (`src/report/`) — Generates migration summary with metrics
- **Skills** (`src/skills/`) — Plugin transformations (built-in + custom)
- **State** (`src/state/`) — Persists migration progress across sessions
- **Events** (`src/events/`) — Publishes lifecycle events (file-started, batch-completed, etc.)

## Project Structure

```
project-squad-sdk-example-migration/
├── src/
│   ├── types/               # TypeScript interfaces
│   │   ├── config.ts        # MigrationConfig, BatchingConfig
│   │   ├── state.ts         # FileStatus, MigrationState
│   │   └── migration.ts     # Analysis, Batch, BatchResult
│   ├── config/
│   │   └── loader.ts        # Load/validate migration config from JSON
│   ├── state/
│   │   └── manager.ts       # In-memory state with persistence
│   ├── events/
│   │   └── bus.ts           # EventBus wrapper for migration events
│   ├── agents/              # Squad agents for each stage
│   │   ├── analyzer/        # Scan codebase, build dependency graph
│   │   ├── transformer/     # Apply codemods to files
│   │   └── tester/          # Run tests and validate
│   ├── planner/
│   │   └── index.ts         # Create parallel-safe batches
│   ├── executor/
│   │   └── index.ts         # Execute batches with progress tracking
│   ├── cli/
│   │   ├── main.ts          # CLI entry point (squad-migrate)
│   │   └── progress.ts      # Real-time progress display
│   ├── orchestrator/
│   │   └── index.ts         # Coordinate full pipeline
│   ├── report/
│   │   └── reporter.ts      # Generate final migration report
│   └── index.ts             # Main export barrel
├── examples/
│   └── migration.json       # Sample migration config
├── test/
│   ├── features/            # Feature-level tests (TDD)
│   ├── integration/         # End-to-end tests
│   └── fixtures/            # Test data and sample codebases
├── PLAN.md                  # TDD implementation roadmap
├── QUICKSTART.md            # Step-by-step walkthrough
├── README.md                # This file
├── package.json
└── tsconfig.json
```

## SDK Modules Used

| Module | Purpose |
|--------|---------|
| `builders.defineAgent()` | Create migration-specific agents (Analyzer, Transformer, Tester) |
| `runtime.EventBus` | Track migration progress events |
| `state.SquadState` | Persist per-file migration status, resume across sessions |
| `hooks.HookPipeline` | Enforce migration rules and state transitions |

## Testing

```bash
# Run all tests
npm test

# Run in watch mode
npm test:watch

# Run specific feature
npm test -- features/config.test.ts
```

**Test coverage:**
- Configuration loading and validation
- State persistence and hydration
- Event bus and lifecycle
- Analyzer file discovery and dependency graph
- Batching and topological sorting
- Transformer agent contract
- Test validator integration
- Rollback on failure
- Progress CLI updates
- Full orchestration pipeline (end-to-end)

## Development

This project follows **Test-Driven Development** with phases outlined in [`PLAN.md`](./PLAN.md):

1. **Phase 1** — Configuration schema, state persistence, event bus
2. **Phase 2** — Analyzer agent, planner, reporting
3. **Phase 3** — Transformer agent, test validation, batch execution
4. **Phase 4** — Progress CLI, orchestrator, status reporting
5. **Phase 5** — Skill integration, platform adapter

To implement a new feature:

1. Write tests in `test/features/{name}.test.ts` (test-first)
2. Implement source in `src/` to make tests pass
3. Run full test suite: `npm test`
4. Mark feature complete in `PLAN.md`

## Roadmap

**MVP (Complete):**
- ✅ Core infrastructure (config, state, events)
- ✅ Analyzer agent
- ✅ Migration planner with topological sort
- ✅ Batch executor with parallelism
- ✅ Test validator
- ✅ Rollback on failure
- ✅ Progress CLI

**P1 (Next):**
- Dependency ordering refinement
- Incremental mode (pause/resume)
- Full codemod integration (jscodeshift, ts-morph)
- PR batching strategies
- Migration dry-run
- Confidence scoring

## License

MIT

---

**Next Steps:** See [QUICKSTART.md](./QUICKSTART.md) to run your first migration.
