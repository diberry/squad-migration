# QUICKSTART: Run Your First Migration

This guide walks you through setting up the migration tool, configuring your first migration, and executing it end-to-end.

## Prerequisites

- **Node.js** ≥ 18.x — [Download](https://nodejs.org)
- **npm** ≥ 9.x (comes with Node.js)
- **git** — For version control and rollback
- A codebase to migrate (or use the sample in `test/fixtures/sample-codebase/`)

## 5-Minute Setup

### 1. Clone and Install

```bash
git clone https://github.com/bradygaster/squad-sdk-example-migration.git
cd project-squad-sdk-example-migration

npm install
npm run build
```

**Expected output:**
```
added 150+ packages
npm run build
> tsc
✓ TypeScript compiled successfully
```

### 2. Verify Tests Pass

```bash
npm test
```

**Expected output:**
```
✓ src/types/config.test.ts (12 tests)
✓ src/config/loader.test.ts (8 tests)
✓ src/state/manager.test.ts (10 tests)
... (all 100+ tests passing)

Test Files  15 passed (15)
Tests       150 passed (150)
```

## Your First Migration: Express → Fastify

### Step 1: Create Migration Config

Create `my-first-migration.json`:

```json
{
  "name": "express-to-fastify-upgrade",
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
    "filesPerBatch": 5,
    "parallelBatches": 2
  },
  "rollback": {
    "onTestFailure": true
  },
  "skills": [
    "express-to-fastify-routing",
    "middleware-adapter"
  ]
}
```

**What each section does:**

- **source/target** — Defines the migration direction (Express 👉 Fastify)
- **agents** — Specifies which AI models run each phase
- **batching** — 5 files per batch, 2 batches running in parallel
- **rollback** — Automatically revert if tests fail
- **skills** — Custom transformation patterns to apply

### Step 2: Prepare Your Codebase

Copy your codebase or use the test fixture:

```bash
# Option A: Use your own codebase (must have tests!)
cd /path/to/my-app

# Option B: Use sample fixture (for testing)
cp -r project-squad-sdk-example-migration/test/fixtures/sample-codebase ./my-app
cd my-app
```

**Requirements:**
- Must have a git repository (`git init` if needed)
- Must have tests (`package.json` with test script)
- Must have package.json with dependencies

### Step 3: Initialize Migration State

```bash
# From project root
node dist/orchestrator.js init /path/to/my-app my-first-migration.json
```

**Expected output:**
```
🔍 Analyzing codebase...
  ✓ Found 42 files matching src/**/*.ts
  ✓ Built dependency graph (38 imports)
  ✓ Estimated complexity: 18 easy, 22 medium, 2 hard

📊 Migration Plan:
  Batches:     9 batches
  Files:       42 files
  Parallelism: 2 concurrent
  EST. Time:   ~45 minutes

✅ State initialized: .squad/migration-state.json

Ready to run: npm run migrate
```

### Step 4: Run the Full Migration

```bash
node dist/orchestrator.js run /path/to/my-app my-first-migration.json
```

**This executes:**

1. **Analysis** (30 sec) — Scan files, build dependency graph
2. **Planning** (10 sec) — Create parallel-safe batches
3. **Transformation** (varies) — Apply codemods to each file
4. **Testing** (varies) — Run tests after each batch
5. **Reporting** (5 sec) — Generate summary and metrics

**Expected output during execution:**

```
🚀 Migration: express-to-fastify-upgrade

[Analyzing Codebase] ████████████████ 100% (42/42 files)

[Planning Batches] ████████████████ 100% (9 batches)

[Executing] ████████████░░░░░░░░░░░░░░░░ 30% (13/42 migrated)
  📦 Batch 1: ✅ PASSED (5 files in 12 sec)
  📦 Batch 2: ⏳ IN PROGRESS (3 of 5 files)

⏱ Time remaining: ~20 min
🎯 Success rate: 100% (13/13)
⚠️  Skipped: 0
```

### Step 5: Monitor Progress

The CLI shows real-time progress. You can also check state in another terminal:

```bash
cat .squad/migration-state.json | jq '.files | group_by(.status) | map({status: .[0].status, count: length})'
```

**Expected output:**
```json
[
  { "status": "migrated", "count": 13 },
  { "status": "in-progress", "count": 5 },
  { "status": "pending", "count": 24 }
]
```

### Step 6: Handle Failures (if any)

If a batch fails tests, the orchestrator:

1. **Immediately stops** execution of remaining batches
2. **Rolls back** the failed batch to pre-migration state
3. **Prompts** for next action:

```
❌ Batch 3 test failed

Failed tests:
  ✗ POST /users (expected 200, got 500)
  ✗ GET /users/:id (middleware mismatch)

Batch rolled back to original state.

What would you like to do?
[1] Retry this batch
[2] Skip this batch (manual fix later)
[3] Review the failed files
[4] Cancel and rollback all migrations
```

**Choose an option:**

- **Retry** — Re-run transformation (useful if it was a transient error)
- **Skip** — Mark files as skipped, continue with remaining batches
- **Review** — Open files in editor to debug
- **Cancel** — Rollback everything and start over

### Step 7: Review Results

After completion:

```bash
npm run report
```

**Example output:**

```
📊 Migration Report: express-to-fastify-upgrade

Summary:
  Total files:    42
  ✅ Migrated:    40 (95.2%)
  ❌ Failed:      1  (2.4%)
  ⏭ Skipped:     1  (2.4%)

Complexity Breakdown:
  Easy (0-100 LOC):        18 files ✅ all migrated
  Medium (100-500 LOC):    20 files ✅ 19 migrated, 1 failed
  Hard (500+ LOC):         2 files ✅ 2 migrated

⏱ Execution Time:
  Analysis:     45 sec
  Planning:     12 sec
  Transformation: 8m 23s
  Testing:      3m 12s
  Total:        12m 32s

📈 Throughput: 3.2 files/minute

Failed Files (review manually):
  • src/routes/users.ts
    Reason: Complex middleware chain not recognized by pattern
    Fix: Update transform pattern in skills/middleware-adapter.ts

Next Steps:
  1. Fix src/routes/users.ts manually
  2. Run npm run validate to confirm tests pass
  3. Run: npm run migrate -- --resume to continue
```

### Step 8: Create Pull Request

After successful migration, create a PR with changes:

```bash
git checkout -b squad/express-to-fastify
git add src/
git commit -m "Migrate from Express to Fastify

- Updated 40 files to Fastify API
- All tests passing
- Middleware patterns converted
- Dependency injection refactored
"

git push origin squad/express-to-fastify
gh pr create --base main --title "Migrate from Express to Fastify"
```

## Common Workflows

### Resume a Paused Migration

If you stopped mid-migration:

```bash
node dist/orchestrator.js run /path/to/my-app my-first-migration.json --resume
```

The orchestrator skips already-migrated files and resumes from the next pending batch.

### Dry-Run (Preview without Applying)

See what *would* be migrated without making changes:

```bash
node dist/orchestrator.js analyze /path/to/my-app my-first-migration.json
```

**Output:**
```
Files to migrate:
  • src/server.ts
  • src/routes/users.ts
  • src/routes/products.ts
  ...

Estimated time: ~15 minutes
Estimated cost: 240 API tokens
```

### Validate Tests After Manual Fix

After manually fixing a failed file:

```bash
node dist/orchestrator.js validate /path/to/my-app
```

**Output:**
```
Running tests...
  ✓ All 120 tests passing
✅ Ready to commit
```

### Rollback Everything and Start Over

If things went wrong:

```bash
node dist/orchestrator.js rollback /path/to/my-app
```

**This:**
1. Restores all migrated files to pre-migration state
2. Clears migration state (`.squad/migration-state.json`)
3. Resets git history to before migration started

```
⚠️ Rollback completed
  Files restored: 40
  Git history: Reset to commit abc123d

✅ Codebase is back to original state
Run: npm run migrate (to try again)
```

## Tips & Tricks

### 1. Monitor Parallelism

Increase `parallelBatches` for faster migrations (but may hit API rate limits):

```json
"batching": {
  "filesPerBatch": 5,
  "parallelBatches": 4    // ← was 2, now 4 concurrent
}
```

### 2. Focus on High-Risk Files First

Set `filesPerBatch` to 1 and test thoroughly:

```json
"batching": {
  "filesPerBatch": 1,     // ← one file per batch
  "parallelBatches": 1    // ← sequential execution
}
```

This catches problems early.

### 3. Check Migration History

```bash
cat .squad/migration-state.json | jq '.migrationHistory'
```

Shows every step taken and timestamps.

### 4. Debug Agent Decisions

If transformation isn't working:

```bash
node dist/orchestrator.js debug /path/to/my-app my-first-migration.json
```

Shows internal agent reasoning and pattern matching.

### 5. Custom Skills

Add migration-specific patterns:

```bash
mkdir -p .squad/skills/my-patterns
cat > .squad/skills/my-patterns/custom-transform.ts << 'EOF'
export const customTransform = (code: string) => {
  // Your codemod logic
  return transformedCode;
};
EOF
```

Reference in config: `"skills": ["my-patterns/custom-transform"]`

## Troubleshooting

### "Tests failing after transformation"

**Likely cause:** Transformation incomplete or pattern mismatch

**Fix:**
1. Check failed file output: `cat .squad/migration-state.json | jq '.files[] | select(.status=="failed")'`
2. Review transformation: `git diff HEAD~ -- <filename>`
3. Update skill pattern in config
4. Retry: `npm run migrate -- --resume`

### "Out of API quota during parallel batches"

**Likely cause:** Too many concurrent agents

**Fix:** Reduce parallelism in config:

```json
"batching": {
  "filesPerBatch": 10,      // ← fewer per batch
  "parallelBatches": 1      // ← sequential for now
}
```

### "Dependency graph incomplete"

**Likely cause:** Non-standard imports (dynamic require, lazy-loading)

**Fix:** Check `.squad/migration-state.json` for import analysis:

```bash
cat .squad/migration-state.json | jq '.analysis.dependencies | keys | .[:5]'
```

### "Rollback didn't work"

Ensure git history is clean:

```bash
git status              # Should show no uncommitted changes
git log --oneline -5    # Should show pre-migration commits
```

If stuck, manually reset:

```bash
git reset --hard HEAD~1  # Go back one commit
npm test                 # Verify
```

## Next Steps

- 📖 Read [README.md](./README.md) for architecture and SDK details
- 🏗️ Review [PLAN.md](./PLAN.md) for implementation roadmap
- 🧪 Write tests for custom skills: `npm test -- features/skill-integration.test.ts`
- 🚀 Deploy to CI/CD for automated migrations

---

**Questions?** Check the [README.md](./README.md) or open an issue.
