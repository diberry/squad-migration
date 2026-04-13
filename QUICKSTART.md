# QUICKSTART: Run Your First Migration

This guide walks you through prerequisites, setup, and executing your first migration end-to-end — **zero code writing required**.

## Prerequisites

- **Node.js** ≥ 18.x — [Download](https://nodejs.org)
- **npm** ≥ 9.x (comes with Node.js)
- **git** — For version control and rollback
- A codebase to migrate (or use the sample fixture included)

## 5-Minute Setup

### Step 0: Clone and Build

```bash
git clone https://github.com/bradygaster/squad-sdk-example-migration.git
cd project-squad-sdk-example-migration

npm install
npm run build
```

**Verify it worked:**
```bash
npm test
```

You should see all 57 tests passing.

---

## Step 1: Create Migration Config

A migration config is a JSON file that tells Squad what to migrate and how.

Create `my-migration.json` in the project root:

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
    "tester": { "model": "gpt-5" }
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

**What this means:**
- **source** — Find all `.ts` files in `src/` (Express code)
- **target** — Migrate them to Fastify 4.0.0
- **agents** — Use Claude Opus for analysis + transformation, GPT-5 for testing
- **batching** — Process 5 files per batch, run 2 batches in parallel
- **rollback** — Auto-revert if tests fail
- **skills** — Apply these transformation patterns

---

## Step 2: Prepare Your Codebase

You need a codebase with git and tests. Choose one:

### Option A: Use Your Own Codebase

```bash
cd /path/to/my-app

# Must have git
git init   # (if not already a repo)
git add .
git commit -m "Initial commit"

# Must have tests
npm test   # (should pass before migration)
```

**Then come back to project root:**
```bash
cd /path/to/project-squad-sdk-example-migration
```

### Option B: Use the Sample Fixture (Recommended for testing)

```bash
# From project root
cp -r test/fixtures/sample-codebase ./my-app
cd my-app
git init
git add .
git commit -m "Initial commit"
npm install
npm test

cd ..  # Back to project root
```

---

## Step 3: Initialize Migration State

Tell Squad to analyze your codebase and create a migration plan:

```bash
node dist/index.js init /path/to/my-app my-migration.json
```

**What it does:**
1. Scans files matching `src/**/*.ts`
2. Analyzes import statements and builds dependency graph
3. Groups files into parallel-safe batches
4. Saves plan to `.squad/migration-state.json`

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
Ready to run: node dist/index.js run /path/to/my-app my-migration.json
```

---

## Step 4: Run the Migration

Execute the full migration with live progress:

```bash
node dist/index.js run /path/to/my-app my-migration.json
```

**This does:**
1. **Analysis** (30 sec) — Verify codebase snapshot
2. **Planning** (10 sec) — Confirm batch order
3. **Transformation** (varies) — Apply codemods concurrently
4. **Testing** (varies) — Run tests after each batch
5. **Reporting** (5 sec) — Generate summary

**Live progress output:**
```
🚀 Migration: express-to-fastify-upgrade

[Analyzing Codebase] ████████████████ 100% (42/42 files)

[Planning Batches] ████████████████ 100% (9 batches)

[Executing] ████████░░░░░░░░░░░░░░░░░░░░░░░░░░ 30% (13/42 migrated)
  📦 Batch 1: ✅ PASSED (5 files in 12 sec)
  📦 Batch 2: ✅ PASSED (5 files in 11 sec)
  📦 Batch 3: ⏳ IN PROGRESS (3 of 5 files done)

⏱ Time remaining: ~20 min
🎯 Success rate: 100% (13/13)
⚠️  Skipped: 0
```

The CLI refreshes in real-time. You can close it with **Ctrl+C** (migration continues in background).

---

## Step 5: Check Progress While Running

In another terminal, check the state file to see current status:

```bash
cat .squad/migration-state.json | jq '.files | group_by(.status) | map({status: .[0].status, count: length})'
```

**Example output:**
```json
[
  { "status": "migrated", "count": 13 },
  { "status": "in-progress", "count": 5 },
  { "status": "pending", "count": 24 }
]
```

---

## Step 6: Handle Failures (if any)

If a batch fails tests, the orchestrator stops, rolls back, and prompts you:

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

**Your options:**

- **[1] Retry** — Re-run transformation (useful if transient error)
- **[2] Skip** — Mark files as skipped, continue to next batch
- **[3] Review** — Open failed files in an editor
- **[4] Cancel** — Rollback all changes, start over

Type the number and press Enter.

---

## Step 7: Verify Results

After migration completes, generate a report:

```bash
node dist/index.js report /path/to/my-app
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
  Easy (0-100 LOC):       18 files ✅ all migrated
  Medium (100-500 LOC):   20 files ✅ 19 migrated, 1 failed
  Hard (500+ LOC):        2 files ✅ 2 migrated

⏱ Execution Time:
  Analysis:      45 sec
  Planning:      12 sec
  Transformation: 8m 23s
  Testing:       3m 12s
  Total:         12m 32s

📈 Throughput: 3.2 files/minute

Failed Files (review manually):
  • src/routes/users.ts
    Reason: Complex middleware chain not recognized
    Fix: Update transform pattern in skills/

Next Steps:
  1. Fix src/routes/users.ts manually
  2. Run npm test to confirm
  3. Resume: node dist/index.js run . my-migration.json --resume
```

---

## Common Workflows

### Resume a Paused Migration

If you stopped mid-migration or a batch failed:

```bash
node dist/index.js run /path/to/my-app my-migration.json --resume
```

Squad skips already-migrated files and resumes from the next pending batch.

### Preview What Would Be Migrated (Dry-Run)

See files and time estimate without applying changes:

```bash
node dist/index.js analyze /path/to/my-app my-migration.json
```

**Output:**
```
Files to migrate:
  • src/server.ts
  • src/routes/users.ts
  • src/routes/products.ts
  ... (42 total)

Estimated time: ~15 minutes
Estimated cost: 240 API tokens
```

### Validate Tests After Manual Fix

After manually fixing a failed file:

```bash
cd /path/to/my-app
npm test
```

If all tests pass, commit the fix:

```bash
git add src/
git commit -m "Manual fix to src/routes/users.ts"
```

Then resume migration:

```bash
cd /path/to/project-squad-sdk-example-migration
node dist/index.js run /path/to/my-app my-migration.json --resume
```

### Rollback Everything and Start Over

Undo all changes and reset to pre-migration state:

```bash
node dist/index.js rollback /path/to/my-app
```

**This:**
1. Restores all migrated files to original code
2. Clears migration state (`.squad/migration-state.json`)
3. Resets git history to before migration started

**Output:**
```
⚠️ Rollback completed
  Files restored: 40
  Git history: Reset to commit abc123d

✅ Codebase is back to original state
Run: node dist/index.js run /path/to/my-app my-migration.json (to try again)
```

---

## Tips & Tricks

### Make Migrations Faster

Increase parallelism in `my-migration.json`:

```json
"batching": {
  "filesPerBatch": 10,      // ← more files per batch
  "parallelBatches": 4      // ← more parallel workers (was 2)
}
```

**Tradeoff:** Higher parallelism = faster, but risk hitting API rate limits.

### Make Migrations More Careful

Decrease parallelism to catch errors early:

```json
"batching": {
  "filesPerBatch": 1,       // ← one file at a time
  "parallelBatches": 1      // ← no parallelism
}
```

This is slow but catches pattern mismatches immediately.

### Check Migration History

```bash
cat .squad/migration-state.json | jq '.history' -r
```

Shows every step taken with timestamps (useful for debugging).

### Debug Agent Decisions

If transformation isn't working as expected:

```bash
node dist/index.js debug /path/to/my-app my-migration.json
```

Shows internal agent reasoning and which patterns matched.

---

## Troubleshooting

### "Tests failing after transformation"

**Most likely cause:** Transformation incomplete or pattern didn't match expected code

**Fix:**
1. Check which file failed: `cat .squad/migration-state.json | jq '.files[] | select(.status=="failed")'`
2. Review the diff: `git diff HEAD -- <failed-file>`
3. Update the skill pattern in `my-migration.json` or `src/skills/`
4. Resume: `node dist/index.js run /path/to/my-app my-migration.json --resume`

### "Dependency graph incomplete"

**Likely cause:** Non-standard imports (dynamic `require()`, lazy-loading)

**Fix:** Manually add missing dependencies to state file:

```bash
cat .squad/migration-state.json | jq '.analysis.dependencies'
```

If you see gaps, report to Squad team.

### "Out of API quota"

**Likely cause:** Too many concurrent agents hitting rate limits

**Fix:** Reduce parallelism:

```json
"batching": {
  "filesPerBatch": 10,
  "parallelBatches": 1      // ← was 3, now 1 (sequential)
}
```

Then resume: `node dist/index.js run /path/to/my-app my-migration.json --resume`

### "Rollback didn't work"

Ensure git history is clean before migration:

```bash
git status              # Should show no uncommitted changes
git log --oneline -3    # Check recent commits
```

If migration started dirty, manually reset:

```bash
git reset --hard <pre-migration-commit-hash>
npm test  # Verify
```

---

## Next Steps

- 📖 Read [README.md](./README.md) for architecture overview and extending with custom rules
- 🏗️ Review [PLAN.md](./PLAN.md) for implementation roadmap and phases
- 🧪 Write custom transformation skills: see "Extending This Example" in README.md
- 🚀 Integrate into CI/CD for automated migrations

---

**Questions?** Check [README.md](./README.md) or open an issue on GitHub.
