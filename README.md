# Squad-Powered Code Migration Tool

A migration orchestration framework built on **Squad SDK** that parallelizes framework upgrades and code transformations using specialized agents for analysis, transformation, testing, and rollback. This MVP focuses on orchestrating complex, multi-stage code migrations with deterministic batching, automated testing, and safe rollback capabilities.

## What It Does

**Features:**

- **Automated Codebase Analysis** — Scans codebases for files matching migration patterns, builds dependency graphs, and estimates complexity
- **Intelligent Batching** — Groups files into parallel-safe batches respecting dependency order and resource constraints
- **Parallel Transformation** — Runs multiple transformer agents concurrently using Squad's worker pool (transforms are pattern-based string replacement for demonstration — production use would integrate AST-based tools like jscodeshift or ts-morph)
- **Automated Test Validation** — Runs a configurable test command after each batch to catch regressions (falls back to simulated pass when no test command is configured)
- **Safe Rollback** — Reverts failed batches to pre-migration state without affecting completed work
- **Real-Time Progress Tracking** — Live CLI dashboard showing migration progress, batch status, and ETAs
- **State Persistence** — Resumes migrations across sessions using Squad's state layer
- **Event-Driven Architecture** — Full visibility into migration lifecycle via event bus

## Architecture

```
┌─────────────┐
│  Codebase   │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│ Analyzer Agent   │ ◄─── Scans files, builds dependency graph
├──────────────────┤
│ • File inventory │
│ • Dependencies   │
│ • Complexity est │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Migration        │ ◄─── Creates parallel-safe batches
│ Planner          │
├──────────────────┤
│ • Topological    │
│   sort           │
│ • Batch groups   │
└────────┬─────────┘
         │
         ▼
    ┌────────────────────────────────────┐
    │     Batch Queue (up to N parallel) │
    └────┬──────┬──────┬────────────────┘
         │      │      │
         ▼      ▼      ▼
      ┌──────────────────────┐
      │ Transformer Agents   │ ◄─── Run codemods in parallel
      │ (concurrent workers) │
      └──────────┬───────────┘
                 │
                 ▼
      ┌──────────────────────┐
      │ Tester Agent         │ ◄─── Validate all tests pass
      └──────────┬───────────┘
                 │
          ┌──────┴──────┐
          ▼             ▼
      ✅ Pass      ❌ Fail
          │             │
          ▼             ▼
      Commit        Rollback Agent ◄─── Git-based safe rollback
          │
          ▼
    ┌──────────────┐
    │ Reporter     │ ◄─── Final summary + metrics
    └──────────────┘
```

## SDK Modules Used

| Module | Purpose | Usage |
|--------|---------|-------|
| `builders.defineAgent()` | Create migration-specific agents (Analyzer, Transformer, Tester) | Define agent contracts and constraints |
| `builders.defineRouting()` | Route file types to specialist agents | Enable flexible codemod strategies |
| `runtime.EventBus` | Track migration progress events | File-started, batch-completed, migration-completed |
| `state.SquadState` | Persist per-file migration status | Resume across sessions, prevent re-processing |
| `skills.SkillRegistry` | Load migration-specific transformation skills | Plugin custom codemods and rules |
| `hooks.HookPipeline` | Enforce migration rules (no pattern mixing, etc) | Prevent invalid state transitions |
| `platform.createPlatformAdapter()` | Create tracking issues and PRs | Group completed batches into PRs |
| `ralph.RalphMonitor` | Monitor migration progress and agent health | Alert on failures, estimate completion |

## Project Structure

```
project-squad-sdk-example-migration/
├── src/
│   ├── types/               # TypeScript interfaces
│   │   ├── config.ts        # MigrationConfig, BatchingConfig, etc
│   │   ├── state.ts         # FileStatus, MigrationState
│   │   └── migration.ts      # Analysis, Batch, etc
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
│   │   └── progress.ts      # Real-time progress display
│   ├── orchestrator/
│   │   └── index.ts         # Coordinate full pipeline
│   └── index.ts             # Main export barrel
├── test/
│   ├── features/            # Feature-level tests (TDD)
│   ├── integration/         # End-to-end tests
│   └── fixtures/            # Test data and sample codebases
├── PLAN.md                  # Complete TDD implementation roadmap
├── README.md                # This file
├── QUICKSTART.md            # Step-by-step setup guide
├── package.json
└── tsconfig.json
```

## Installation

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x

### Setup

```bash
# Clone the repository
git clone https://github.com/bradygaster/squad-sdk-example-migration.git
cd project-squad-sdk-example-migration

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run tests
npm test
```

## Configuration

Migrations are configured via JSON file. See example below:

```json
{
  "name": "express-to-fastify-migration",
  "source": {
    "framework": "express",
    "pattern": "src/**/*.ts"
  },
  "target": {
    "framework": "fastify",
    "version": "4.0.0"
  },
  "agents": {
    "analyzer": { "model": "claude-opus-4" },
    "transformer": { "model": "claude-opus-4" },
    "tester": { "model": "gpt-5" },
    "reviewer": { "model": "claude-opus-4" }
  },
  "batching": {
    "filesPerBatch": 10,
    "parallelBatches": 3
  },
  "rollback": {
    "onTestFailure": true
  },
  "skills": [
    "express-to-fastify-patterns",
    "route-param-conversion",
    "middleware-adapter"
  ]
}
```

**Configuration Fields:**

- `name` — Human-readable migration identifier
- `source.framework` — Source framework (e.g., "express")
- `source.pattern` — Glob pattern for files to migrate
- `target.framework` — Target framework (e.g., "fastify")
- `target.version` — Target version
- `agents` — Agent models for each role (analyzer, transformer, tester, reviewer)
- `batching.filesPerBatch` — Max files per batch (1-100)
- `batching.parallelBatches` — Concurrent batch limit
- `rollback.onTestFailure` — Automatically rollback if tests fail
- `skills` — Names of custom transformation skills to load

## How to Migrate Code

See **[QUICKSTART.md](./QUICKSTART.md)** for step-by-step walkthrough with example commands.

Quick overview:

```bash
# 1. Create migration config
cp migration-config.example.json my-migration.json
# Edit my-migration.json with your settings

# 2. Build and run the orchestrator
npm run build
node dist/index.js /path/to/codebase my-migration.json

# 3. Monitor progress in the CLI dashboard
# (live batch status, file count, time remaining)

# 4. If tests fail, orchestrator auto-rollbacks and prompts next steps
# (retry, skip file, manual fix, etc)
```

## Testing

```bash
# Run all tests
npm test

# Run in watch mode
npm test:watch

# Run specific feature
npm test -- features/config.test.ts
```

**Test Coverage:**

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
- Full codemod integration
- PR batching strategies
- Migration dry-run
- Confidence scoring

## Contributing

Follow the development workflow in [`PLAN.md`](./PLAN.md) and use TDD for all new features.

## License

MIT

---

**Next Steps:** See [QUICKSTART.md](./QUICKSTART.md) to run your first migration.
