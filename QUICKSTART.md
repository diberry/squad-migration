# QUICKSTART: Run Your First Migration

This guide walks you through prerequisites, setup, and executing your first migration end-to-end — **zero code writing required**.

## Prerequisites

- **Node.js** ≥ 18.x — [Download](https://nodejs.org)
- **npm** ≥ 9.x (comes with Node.js)
- **git** — For version control and rollback

## Setup

```bash
git clone https://github.com/bradygaster/squad-sdk-example-migration.git
cd project-squad-sdk-example-migration

npm install
npm run build
npm link   # makes `squad-migrate` available globally
```

**Verify it worked:**
```bash
squad-migrate --help
npm test
```

---

## Step 1: Create Migration Config

```bash
squad-migrate init --config migration.json
```

This creates a sample `migration.json` with sensible defaults. Edit it for your project:

- Set `source.pattern` to match your files (e.g., `src/**/*.ts`)
- Set `source.framework` and `target.framework` to your migration pair
- Adjust `batching` for your codebase size

See [`examples/migration.json`](./examples/migration.json) for a reference config.

---

## Step 2: Analyze Your Codebase (Dry-Run)

```bash
squad-migrate analyze --config migration.json
```

**Expected output:**
```
🔍 Analysis: express-to-fastify
   Files found:   42
   Easy:          18
   Medium:        22
   Hard:          2
   Batches:       9
   Parallelism:   3

   No changes made (dry-run).
```

No files are modified. Review the counts to confirm the right files were found.

---

## Step 3: Run the Migration

```bash
squad-migrate run --config migration.json
```

**Expected output:**
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

The executor runs batches concurrently, rolls back automatically on test failure.

---

## Step 4: Check Status

```bash
squad-migrate status --config migration.json
```

**Example output:**
```
📊 Status: express-to-fastify
   Total:      42
   Migrated:   40
   Failed:     1
   Skipped:    1
   In Progress:0

   Failed files:
     ✗ src/routes/users.ts: Complex middleware chain not recognized
```

---

## Step 5: Rollback (if needed)

```bash
squad-migrate rollback --config migration.json
```

This resets all file statuses to `pending`. To also restore file contents:

```bash
git checkout -- .
```

---

## Troubleshooting

### Config validation failed

Check that your `migration.json` includes all required fields. Run `squad-migrate init` to see the expected shape, then compare.

### No files found

Verify `source.pattern` in your config matches files in the current directory. The analyzer runs from `process.cwd()`.

### Tests failing after transformation

1. Check which files failed: `squad-migrate status --config migration.json`
2. Review the diff: `git diff HEAD -- <failed-file>`
3. Fix and re-run: `squad-migrate run --config migration.json`

---

## Next Steps

- 📖 Read [README.md](./README.md) for architecture overview and programmatic API
- 🏗️ Review [PLAN.md](./PLAN.md) for implementation roadmap
- 🚀 Integrate into CI/CD for automated migrations
