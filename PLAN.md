# TDD Implementation Plan: Squad-Powered Code Migration Tool

## Project Vision

A migration orchestration framework built on Squad SDK that parallelizes framework upgrades using specialized agents for analysis, transformation, testing, and rollback. This MVP focuses on **one migration family** (e.g., Express→Fastify or JS→TS) before generalizing.

## Verified SDK Modules (from PRD)

| Module | Purpose | Status |
|--------|---------|--------|
| `builders.defineRouting()` | Route file types to specialist agents | ✓ Available |
| `builders.defineAgent()` | Create migration-specific agents | ✓ Available |
| `runtime.EventBus` | Track migration progress events | ✓ Available |
| `state.SquadState` | Track per-file migration status | ✓ Available |
| `skills.SkillRegistry` | Load migration-specific skills | ✓ Available |
| `hooks.HookPipeline` | Enforce migration rules | ✓ Available |
| `platform.createPlatformAdapter()` | Create tracking issues and PRs | ✓ Available |
| `ralph.RalphMonitor` | Monitor migration progress and agent health | ✓ Available |

## Architecture Overview

```
Codebase ──→ Analyzer Agent
               ├── File inventory (what needs migrating)
               ├── Dependency graph (what order)
               ├── Complexity estimation
               │
               ▼
        Migration Planner ──→ Batch Queue
                                 │
                     ┌───────────┼───────────┐
                     ▼           ▼           ▼
               Transform A   Transform B   Transform C
               (Agent 1)     (Agent 2)     (Agent 3)
                     │           │           │
                     └───────────┼───────────┘
                                 ▼
                         Test Runner Agent
                           ├── Pass → commit batch
                           └── Fail → rollback batch
                                 │
                         Review Agent ──→ Final PR
```

## Phase 1: Core Infrastructure (Weeks 1-2)

### Feature 1.1: Migration Configuration Schema
**Test First:**
- `test/features/config.test.ts`: MigrationConfig loads from JSON and validates required fields (name, source, target, batching)
- Test schema validation rejects configs with invalid agent models
- Test that source/target patterns are valid glob expressions
- Test batch size constraints (1-100 files per batch)

**Implementation:**
- `src/types/config.ts` — TypeScript interfaces for MigrationConfig, AgentConfig, BatchingConfig
- `src/config/schema.ts` — JSON schema validator using zod or similar
- `src/config/loader.ts` — Load and validate migration config from file

### Feature 1.2: Migration State Persistence
**Test First:**
- `test/features/state.test.ts`: MigrationState tracks file statuses (pending, in-progress, migrated, failed, skipped)
- Test state persists to `.squad/migration-state.json`
- Test state hydrates from disk on startup
- Test concurrent updates don't corrupt state (locking)
- Test state query methods: getFilesByStatus(), getSummary(), getMigrationProgress()

**Implementation:**
- `src/state/types.ts` — FileStatus enum, MigrationState interface
- `src/state/persistence.ts` — Read/write state to Squad state directory
- `src/state/manager.ts` — In-memory state manager with squad/state integration

### Feature 1.3: Migration Event Bus
**Test First:**
- `test/features/events.test.ts`: EventBus emits migration events (file-started, file-completed, batch-completed, migration-completed)
- Test listeners subscribe and receive events in order
- Test events include metadata (file path, status, error details if failed)
- Test EventBus integrates with Squad's EventBus (not a separate implementation)

**Implementation:**
- `src/events/types.ts` — MigrationEvent types
- `src/events/bus.ts` — EventBus adapter wrapping Squad SDK EventBus

## Phase 2: Analysis & Planning (Weeks 2-3)

### Feature 2.1: Analyzer Agent Definition
**Test First:**
- `test/features/analyzer.test.ts`: Analyzer agent accepts codebase root and migration config
- Test analyzer produces file inventory (list of files matching source pattern)
- Test analyzer estimates complexity per file (easy/medium/hard based on file size, imports)
- Test analyzer detects dependencies between files (import graph)
- Test analyzer output is deterministic (same input → same inventory)

**Implementation:**
- `src/agents/analyzer/index.ts` — Define Analyzer agent using `builders.defineAgent()`
- `src/agents/analyzer/file-scanner.ts` — Traverse codebase, find files matching pattern
- `src/agents/analyzer/dependency-graph.ts` — Build import/require dependency graph
- `src/agents/analyzer/complexity.ts` — Estimate per-file migration complexity

### Feature 2.2: Migration Planner
**Test First:**
- `test/features/planner.test.ts`: MigrationPlanner accepts inventory and config
- Test planner creates batches respecting filesPerBatch constraint
- Test planner orders files by dependency (topological sort, shared modules first)
- Test planner creates reasonable batch boundaries (related files together)
- Test planner respects parallelBatches constraint for batch scheduling

**Implementation:**
- `src/planner/types.ts` — Batch, BatchQueue types
- `src/planner/index.ts` — MigrationPlanner orchestrator
- `src/planner/topological-sort.ts` — Dependency-aware file ordering
- `src/planner/batching.ts` — Create batches respecting constraints

### Feature 2.3: Migration Report
**Test First:**
- `test/features/report.test.ts`: MigrationReport summarizes analysis (X files to migrate, Y easy/medium/hard, Z dependencies)
- Test report renders as human-readable text
- Test report includes complexity breakdown and bottleneck analysis

**Implementation:**
- `src/report/analyzer-report.ts` — Format analysis results for user review

## Phase 3: Transformation & Testing (Weeks 3-5)

### Feature 3.1: Transformer Agent
**Test First:**
- `test/features/transformer.test.ts`: Transformer agent accepts file path and migration config
- Test transformer applies migration pattern to file (using external codemod tool)
- Test transformer returns modified file content and change metadata
- Test transformer gracefully handles files that can't be migrated (returns error details)
- Test transformer respects "no mixing old/new patterns" rule via HookPipeline

**Implementation:**
- `src/agents/transformer/index.ts` — Define Transformer agent
- `src/agents/transformer/codemod-runner.ts` — Execute jscodeshift or ts-morph codemods
- `src/agents/transformer/hooks.ts` — HookPipeline enforcement (validate no pattern mixing)
- `src/agents/transformer/error-handler.ts` — Graceful degradation for unmigrateable files

### Feature 3.2: Test Validation Agent
**Test First:**
- `test/features/test-validator.test.ts`: TestValidator accepts migrated batch and runs tests
- Test validator detects test framework (jest, vitest, mocha) and runs relevant tests
- Test validator returns pass/fail and failure details
- Test validator timeout handling (tests don't hang)
- Test validator captures coverage metadata

**Implementation:**
- `src/agents/tester/index.ts` — Define Tester agent
- `src/agents/tester/test-runner.ts` — Detect and execute tests
- `src/agents/tester/parser.ts` — Parse test output and failure details

### Feature 3.3: Batch Execution Engine
**Test First:**
- `test/features/batch-executor.test.ts`: BatchExecutor processes queue respecting parallelBatches
- Test executor runs Transformer agents in parallel (up to N batches concurrently)
- Test executor tracks progress in MigrationState as files complete
- Test executor halts and rolls back on test failure
- Test executor emits events for each file/batch completion

**Implementation:**
- `src/executor/batch-executor.ts` — Orchestrate parallel batch processing
- `src/executor/worker-pool.ts` — Manage concurrent transformer executions
- `src/executor/progress-tracker.ts` — Update state and emit events

### Feature 3.4: Rollback on Test Failure
**Test First:**
- `test/features/rollback.test.ts`: On test failure, rollback restores pre-migration file contents
- Test rollback marks failed files as "failed" in state
- Test rollback preserves git history (git checkout, not file deletion)
- Test rollback allows operator to review and decide: retry, skip, or manual fix
- Test rollback doesn't affect previously successful migrations in earlier batches

**Implementation:**
- `src/executor/rollback.ts` — Git-based rollback for failed batches
- `src/executor/recovery.ts` — State management for partially-completed migrations

## Phase 4: Progress & Orchestration (Weeks 5-6)

### Feature 4.1: Progress CLI
**Test First:**
- `test/features/progress-cli.test.ts`: ProgressCLI displays X/Y files migrated, Z failures, W skipped
- Test CLI refreshes progress on file completion events
- Test CLI shows batch status (in-progress, passed, failed)
- Test CLI shows estimated time remaining (based on throughput)
- Test CLI handles terminal resize and redraw gracefully

**Implementation:**
- `src/cli/progress.ts` — Real-time progress display
- `src/cli/formatter.ts` — Format progress for terminal output

### Feature 4.2: Migration Orchestrator
**Test First:**
- `test/features/orchestrator.test.ts`: Orchestrator coordinates analyzer → planner → executor → reporter
- Test orchestrator accepts codebase path and migration config
- Test orchestrator runs full pipeline end-to-end (analyze → plan → execute → report)
- Test orchestrator saves migration state and allows resume
- Test orchestrator emits lifecycle events (started, analyzing, planning, executing, completed)

**Implementation:**
- `src/orchestrator/index.ts` — Main orchestration coordinator
- `src/orchestrator/lifecycle.ts` — Phase management and event sequencing

### Feature 4.3: Migration Status Reporting
**Test First:**
- `test/features/status-reporter.test.ts`: Reporter generates final summary (X migrated, Y failed, Z skipped)
- Test reporter includes per-file status and error reasons
- Test reporter shows throughput metrics (files per hour)
- Test reporter suggests next steps (retry failed, review skipped)

**Implementation:**
- `src/report/final-report.ts` — Generate completion summary
- `src/report/metrics.ts` — Calculate throughput and success metrics

## Phase 5: Skill Integration (Week 6)

### Feature 5.1: Skill Registry Integration
**Test First:**
- `test/features/skill-integration.test.ts`: SkillRegistry loads migration skills from Squad
- Test skill registry provides transformation rules to Transformer agents
- Test skill registry allows custom skills to be registered
- Test skills are versioned and compatible with config

**Implementation:**
- `src/skills/registry.ts` — Integrate with Squad's SkillRegistry
- `src/skills/types.ts` — MigrationSkill interface

### Feature 5.2: Platform Adapter for PR Creation
**Test First:**
- `test/features/platform-adapter.test.ts`: PlatformAdapter creates GitHub issues and PRs
- Test adapter groups migrated files into logical PR (by batch)
- Test adapter creates PR with migration summary and link to final report
- Test adapter handles multiple repos if needed

**Implementation:**
- `src/platform/adapter.ts` — Wrap Squad's createPlatformAdapter()
- `src/platform/pr-generator.ts` — Generate PR from migration batch

## Known Gaps & Blockers

### Gap 1: External Codemod Tools
- **Status:** Not built (external dependency)
- **Solution:** Will integrate jscodeshift or ts-morph as external tools
- **Action:** Create adapter layer for pluggable codemod engines

### Gap 2: Test Framework Detection
- **Status:** Partial (detection logic needed)
- **Solution:** Scan package.json and test files to determine framework
- **Action:** Build test-framework-detector module

### Gap 3: Dependency Graph Resolution
- **Status:** Partial (basic import analysis)
- **Solution:** Full AST traversal for accurate dependency detection
- **Action:** Use ts-morph for TypeScript, acorn/esprima for JavaScript

### Gap 4: Rollback Atomicity
- **Status:** Not implemented
- **Solution:** Git branch strategy (migrate on temp branch, merge on success)
- **Action:** Document rollback strategy and error recovery

### Gap 5: Semantic Correctness Validation
- **Status:** Out of scope (MVP tests only)
- **Solution:** Test passing is proxy for correctness
- **Action:** Document limitations and add caveat to reports

## P1 Features (Not MVP)

These will be implemented after P0:
- Dependency ordering (topological sort — _partially implemented_)
- Incremental mode (pause/resume across sessions)
- Codemods integration (currently stub)
- PR batching (logical grouping)
- Migration dry-run (preview without applying)
- Migration guide generator (auto-documentation)
- Confidence scoring (pre-migration likelihood estimation)

## Success Criteria (MVP)

| Criterion | Target |
|-----------|--------|
| Configuration loads and validates | ✓ |
| Analyzer identifies files correctly | ≥ 95% accuracy |
| Batches respect parallelism constraints | ✓ |
| Test validation catches regressions | ✓ |
| Rollback on failure is atomic | ✓ |
| Progress CLI updates in real-time | ✓ |
| Full migration pipeline runs end-to-end | ✓ |

## Test File Organization

```
test/
├── features/
│   ├── config.test.ts
│   ├── state.test.ts
│   ├── events.test.ts
│   ├── analyzer.test.ts
│   ├── planner.test.ts
│   ├── report.test.ts
│   ├── transformer.test.ts
│   ├── test-validator.test.ts
│   ├── batch-executor.test.ts
│   ├── rollback.test.ts
│   ├── progress-cli.test.ts
│   ├── orchestrator.test.ts
│   ├── status-reporter.test.ts
│   ├── skill-integration.test.ts
│   └── platform-adapter.test.ts
├── integration/
│   ├── end-to-end.test.ts
│   └── migration-pipeline.test.ts
└── fixtures/
    ├── sample-codebase/
    ├── migration-config.json
    └── test-cases.json
```

## Source File Organization

```
src/
├── types/
│   ├── config.ts
│   ├── state.ts
│   └── migration.ts
├── config/
│   ├── schema.ts
│   ├── loader.ts
│   └── validator.ts
├── state/
│   ├── persistence.ts
│   ├── manager.ts
│   └── types.ts
├── events/
│   ├── bus.ts
│   └── types.ts
├── agents/
│   ├── analyzer/
│   │   ├── index.ts
│   │   ├── file-scanner.ts
│   │   ├── dependency-graph.ts
│   │   └── complexity.ts
│   ├── transformer/
│   │   ├── index.ts
│   │   ├── codemod-runner.ts
│   │   ├── hooks.ts
│   │   └── error-handler.ts
│   └── tester/
│       ├── index.ts
│       ├── test-runner.ts
│       └── parser.ts
├── planner/
│   ├── index.ts
│   ├── topological-sort.ts
│   ├── batching.ts
│   └── types.ts
├── executor/
│   ├── batch-executor.ts
│   ├── worker-pool.ts
│   ├── progress-tracker.ts
│   ├── rollback.ts
│   └── recovery.ts
├── cli/
│   ├── progress.ts
│   └── formatter.ts
├── report/
│   ├── analyzer-report.ts
│   ├── final-report.ts
│   └── metrics.ts
├── platform/
│   ├── adapter.ts
│   └── pr-generator.ts
├── skills/
│   ├── registry.ts
│   └── types.ts
├── orchestrator/
│   ├── index.ts
│   └── lifecycle.ts
└── index.ts (main entry point)
```

## Development Workflow

1. **Pick a feature** from the plan above (follow phase order)
2. **Write tests first** in `test/features/{name}.test.ts`
   - Focus on behavior, not implementation details
   - Use test names from this plan as scaffolding
3. **Implement source** in `src/` to make tests pass
4. **Run full suite** to verify no regressions
5. **Update PLAN.md** as you complete each feature (mark ✓)
6. **Integration test** on sample codebase weekly

## Next Steps

1. ✅ Scaffold project with this PLAN.md
2. Start Phase 1 (Config + State + Events)
3. Implement Analyzer after state layer is solid
4. Build Planner once Analyzer works
5. Transformer and Tester agents follow
6. End-to-end testing at phase 4

---

**Last Updated:** Project initiation
**Status:** Ready for Phase 1 implementation
