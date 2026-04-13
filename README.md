# Squad SDK Example: Code Migration Framework

Orchestrate large-scale code migrations using **Squad SDK** agents that work in parallel: analyze dependencies, transform files in batches, validate with automated tests, and safely rollback on failure. Built for framework upgrades, dependency migrations, and bulk codemod operations.

## Using This Example

### Install

```bash
git clone https://github.com/bradygaster/squad-sdk-example-migration.git
cd project-squad-sdk-example-migration
npm install && npm run build
```

### Create a Migration Config

Migration config files tell Squad how to orchestrate your migration. Save as JSON:

```json
{
  "name": "express-to-fastify",
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
    "tester": { "model": "gpt-5" }
  },
  "batching": {
    "filesPerBatch": 10,
    "parallelBatches": 3
  },
  "rollback": {
    "onTestFailure": true
  },
  "skills": ["express-to-fastify-patterns", "middleware-adapter"]
}
```

**Key fields:**
- **source/target** — Framework + version
- **agents** — AI model for each migration phase (analyzer, transformer, tester)
- **batching** — Files per batch + parallel limit
- **rollback** — Auto-revert on test failure
- **skills** — Transformation patterns to load

### Run the Migration

```bash
# Analyze files & create batches
npm run build
node dist/index.js init /path/to/codebase migration.json

# Execute migration with monitoring
node dist/index.js run /path/to/codebase migration.json
```

**The orchestrator:**
1. Scans files matching your pattern
2. Builds dependency graph
3. Creates parallel-safe batches
4. Transforms files concurrently
5. Runs tests after each batch
6. Rolls back on failure or commits on success

### Monitor Progress

Real-time CLI dashboard shows:
- Files processed / total
- Batch status (✅ passed, ❌ failed, ⏳ running)
- Time remaining + throughput
- Current file being transformed

You can also check state:
```bash
cat .squad/migration-state.json | jq '.files | group_by(.status) | map({status: .[0].status, count: length})'
```

### Handle Rollbacks

If tests fail after transformation:

```bash
# Orchestrator automatically:
# 1. Stops remaining batches
# 2. Reverts failed batch to original code
# 3. Prompts for action: retry, skip, review, or cancel

# If you want manual rollback:
node dist/index.js rollback /path/to/codebase
```

This restores all files and resets git history to pre-migration state.

### Expected Output

```
🚀 Migration: express-to-fastify

[Analyzing] ████████████████ 100% (42 files)
[Planning]  ████████████████ 100% (9 batches)
[Executing] ████████░░░░░░░░ 45% (19/42 migrated)
  📦 Batch 1: ✅ PASSED (5 files, 12s)
  📦 Batch 2: ✅ PASSED (5 files, 11s)
  📦 Batch 3: ⏳ IN PROGRESS (3/5 files done)

⏱ ETA: ~18 min | 🎯 Success: 100% (19/19)

📊 Final Report:
   Total: 42 | Migrated: 40 | Failed: 1 | Skipped: 1
   Time: 22m 30s | Throughput: 1.8 files/min
```

No file contents are printed — only counts, timings, and batch status.

## Extending This Example

### Add Custom Transform Rules

Transform rules live in the `skills/` directory. To add a custom pattern:

```bash
# 1. Create skill file
mkdir -p src/skills/custom
cat > src/skills/custom/my-transform.ts << 'EOF'
export const myTransform = (code: string): string => {
  // Your transformation logic (simple string replacement)
  // For production: use jscodeshift, ts-morph, or other AST tool
  return code.replace(/oldPattern/g, 'newPattern');
};
EOF

# 2. Register in skills registry
# (see src/skills/index.ts for registry pattern)

# 3. Reference in config
{
  "skills": ["custom/my-transform"]
}

# 4. Run migration
npm run build
node dist/index.js run /path/to/codebase migration.json
```

### Integrate AST-Based Tools

For complex transformations, integrate **jscodeshift**, **ts-morph**, or **TypeScript Compiler API**:

1. Install: `npm install jscodeshift @types/jscodeshift`
2. Write codemod in `src/skills/`:

```typescript
import jscodeshift, { FileInfo } from 'jscodeshift';

export const expressToFastifyCodemod = (fileInfo: FileInfo) => {
  const j = jscodeshift;
  const root = j(fileInfo.source);

  // Transform AST
  root.find(j.ImportDeclaration)
    .filter(path => path.value.source.value === 'express')
    .replaceWith(path => {
      path.value.source.value = 'fastify';
      return path.value;
    });

  return root.toSource();
};
```

3. Call from transformer agent
4. Reference in config

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
│   │   └── progress.ts      # Real-time progress display
│   ├── orchestrator/
│   │   └── index.ts         # Coordinate full pipeline
│   ├── report/
│   │   └── reporter.ts      # Generate final migration report
│   ├── skills/
│   │   └── index.ts         # Transform rule registry
│   └── index.ts             # Main export barrel
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
| `skills.SkillRegistry` | Load migration-specific transformation skills |
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
