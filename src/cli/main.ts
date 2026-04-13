#!/usr/bin/env node
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadMigrationConfig, ConfigValidationError } from '../config/loader';
import { StateManager } from '../state/manager';
import { MigrationEventBus } from '../events/bus';
import { AnalyzerAgent } from '../agents/analyzer';
import { MigrationPlanner } from '../planner';
import { BatchExecutor } from '../executor';
import { ProgressDisplay } from './progress';
import { FileStatus } from '../types/state';

const USAGE = `
squad-migrate — Squad SDK migration CLI

Usage:
  squad-migrate init [--config <path>]       Create a sample migration.json
  squad-migrate analyze --config <path>      Analyze source files (dry-run)
  squad-migrate run --config <path>          Execute migration batches
  squad-migrate status --config <path>       Show per-file migration status
  squad-migrate rollback --config <path>     Rollback last migration

Options:
  --config <path>   Path to migration.json (default: ./migration.json)
  --help            Show this help message
`.trim();

function parseArgs(argv: string[]): { command: string; config: string } {
  const args = argv.slice(2);
  const command = args[0] || '';
  let config = 'migration.json';
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--config' && args[i + 1]) {
      config = args[i + 1];
      i++;
    }
  }
  return { command, config };
}

const SAMPLE_CONFIG = {
  name: 'express-to-fastify',
  source: { framework: 'express', pattern: 'src/**/*.ts' },
  target: { framework: 'fastify', version: '4.0.0' },
  agents: {
    analyzer: { model: 'claude-3-opus' },
    transformer: { model: 'claude-3-opus' },
    tester: { model: 'gpt-4' },
    reviewer: { model: 'gpt-4' },
  },
  batching: { filesPerBatch: 10, parallelBatches: 3 },
  rollback: { onTestFailure: true },
};

async function cmdInit(configPath: string): Promise<void> {
  const resolved = path.resolve(configPath);
  if (fs.existsSync(resolved)) {
    console.error(`✗ File already exists: ${resolved}`);
    console.error('  Remove it first or use a different path.');
    process.exitCode = 1;
    return;
  }
  fs.writeFileSync(resolved, JSON.stringify(SAMPLE_CONFIG, null, 2) + '\n', 'utf-8');
  console.log(`✓ Created sample config: ${resolved}`);
  console.log('  Edit it for your migration, then run: squad-migrate analyze --config ' + configPath);
}

async function cmdAnalyze(configPath: string): Promise<void> {
  const config = await loadMigrationConfig(configPath);
  const codebasePath = process.cwd();
  const analyzer = new AnalyzerAgent(config);
  const analysis = await analyzer.analyze(codebasePath);

  console.log(`\n🔍 Analysis: ${config.name}`);
  console.log(`   Files found:   ${analysis.filesCount}`);
  console.log(`   Easy:          ${analysis.complexityBreakdown.easy}`);
  console.log(`   Medium:        ${analysis.complexityBreakdown.medium}`);
  console.log(`   Hard:          ${analysis.complexityBreakdown.hard}`);

  const planner = new MigrationPlanner(config);
  const files = Array.from(analysis.dependencies.keys());
  const batches = planner.createBatches(files, analysis.dependencies);
  console.log(`   Batches:       ${batches.length}`);
  console.log(`   Parallelism:   ${config.batching.parallelBatches}`);
  console.log('\n   No changes made (dry-run).');
}

async function cmdRun(configPath: string): Promise<void> {
  const config = await loadMigrationConfig(configPath);
  const codebasePath = process.cwd();
  const squadDir = path.join(codebasePath, '.squad');

  console.log(`\n🚀 Migration: ${config.name}`);

  const analyzer = new AnalyzerAgent(config);
  const analysis = await analyzer.analyze(codebasePath);
  console.log(`   Analyzed ${analysis.filesCount} files`);

  const planner = new MigrationPlanner(config);
  const files = Array.from(analysis.dependencies.keys());
  const batches = planner.createBatches(files, analysis.dependencies);
  console.log(`   Created ${batches.length} batches`);

  const stateManager = new StateManager(squadDir);
  const eventBus = new MigrationEventBus();
  const progress = new ProgressDisplay();

  await stateManager.initState(config.name, files);

  eventBus.on('batch-completed', (e) => {
    console.log(`   ✅ ${e.batchId} completed`);
  });
  eventBus.on('batch-rollback', (e) => {
    console.log(`   ❌ ${e.batchId} rolled back`);
  });

  const executor = new BatchExecutor(config, stateManager, eventBus);
  const startTime = Date.now();
  await executor.executeBatches(batches);

  const summary = await stateManager.getSummary(config.name);
  const report = progress.displayReport({
    migrated: summary.migrated,
    failed: summary.failed,
    skipped: summary.skipped,
    duration: Date.now() - startTime,
  });
  console.log('\n' + report);
}

async function cmdStatus(configPath: string): Promise<void> {
  const config = await loadMigrationConfig(configPath);
  const squadDir = path.join(process.cwd(), '.squad');
  const stateManager = new StateManager(squadDir);
  const state = await stateManager.getState(config.name);

  if (!state) {
    console.log('No migration state found. Run `squad-migrate run` first.');
    return;
  }

  const summary = state.summary;
  console.log(`\n📊 Status: ${config.name}`);
  console.log(`   Total:      ${summary.total}`);
  console.log(`   Migrated:   ${summary.migrated}`);
  console.log(`   Failed:     ${summary.failed}`);
  console.log(`   Skipped:    ${summary.skipped}`);
  console.log(`   In Progress:${summary.inProgress}`);

  const failed = Object.values(state.files).filter(f => f.status === FileStatus.FAILED);
  if (failed.length > 0) {
    console.log('\n   Failed files:');
    for (const f of failed) {
      console.log(`     ✗ ${f.path}${f.error ? ': ' + f.error : ''}`);
    }
  }
}

async function cmdRollback(configPath: string): Promise<void> {
  const config = await loadMigrationConfig(configPath);
  const squadDir = path.join(process.cwd(), '.squad');
  const stateManager = new StateManager(squadDir);
  const state = await stateManager.getState(config.name);

  if (!state) {
    console.log('No migration state found. Nothing to rollback.');
    return;
  }

  const migratedFiles = Object.values(state.files).filter(
    f => f.status === FileStatus.MIGRATED || f.status === FileStatus.FAILED
  );

  for (const f of migratedFiles) {
    await stateManager.updateFileStatus(config.name, f.path, FileStatus.PENDING);
  }

  console.log(`⚠️  Rollback: reset ${migratedFiles.length} files to pending.`);
  console.log('   Git rollback: run `git checkout -- .` to restore file contents.');
}

async function main(): Promise<void> {
  const { command, config } = parseArgs(process.argv);

  if (!command || command === '--help') {
    console.log(USAGE);
    return;
  }

  try {
    switch (command) {
      case 'init':
        await cmdInit(config);
        break;
      case 'analyze':
        await cmdAnalyze(config);
        break;
      case 'run':
        await cmdRun(config);
        break;
      case 'status':
        await cmdStatus(config);
        break;
      case 'rollback':
        await cmdRollback(config);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        console.log(USAGE);
        process.exitCode = 1;
    }
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      console.error('Config validation failed:');
      for (const e of err.errors) console.error(`  ✗ ${e}`);
      process.exitCode = 1;
    } else {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
  }
}

main();
