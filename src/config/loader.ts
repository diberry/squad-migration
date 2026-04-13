import * as fs from 'node:fs';
import * as path from 'node:path';
import type { MigrationConfig } from '../types/config';

const VALID_MODELS = [
  'gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini',
  'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet',
  'claude-3-haiku', 'claude-3.5-sonnet', 'o1', 'o1-mini',
];

export class ConfigValidationError extends Error {
  constructor(public readonly errors: string[]) {
    super(`Invalid migration config: ${errors.join('; ')}`);
    this.name = 'ConfigValidationError';
  }
}

export async function loadMigrationConfig(configPath: string): Promise<MigrationConfig> {
  const resolved = path.resolve(configPath);
  const raw = await fs.promises.readFile(resolved, 'utf-8');
  const parsed = JSON.parse(raw);
  const errors = getValidationErrors(parsed);
  if (errors.length > 0) {
    throw new ConfigValidationError(errors);
  }
  return parsed as MigrationConfig;
}

export function validateMigrationConfig(config: unknown): config is MigrationConfig {
  return getValidationErrors(config).length === 0;
}

export function getValidationErrors(config: unknown): string[] {
  const errors: string[] = [];
  if (!config || typeof config !== 'object') {
    return ['Config must be a non-null object'];
  }
  const c = config as Record<string, unknown>;

  if (!c.name || typeof c.name !== 'string') errors.push('name is required and must be a string');
  if (!c.source || typeof c.source !== 'object') {
    errors.push('source is required');
  } else {
    const s = c.source as Record<string, unknown>;
    if (!s.framework || typeof s.framework !== 'string') errors.push('source.framework is required');
    if (!s.pattern || typeof s.pattern !== 'string') errors.push('source.pattern is required');
    else if (!isValidGlob(s.pattern as string)) errors.push('source.pattern must be a valid glob');
  }
  if (!c.target || typeof c.target !== 'object') {
    errors.push('target is required');
  } else {
    const t = c.target as Record<string, unknown>;
    if (!t.framework || typeof t.framework !== 'string') errors.push('target.framework is required');
    if (!t.version || typeof t.version !== 'string') errors.push('target.version is required');
  }
  if (!c.agents || typeof c.agents !== 'object') {
    errors.push('agents is required');
  } else {
    const a = c.agents as Record<string, unknown>;
    for (const role of ['analyzer', 'transformer', 'tester', 'reviewer']) {
      if (!a[role] || typeof a[role] !== 'object') {
        errors.push(`agents.${role} is required`);
      } else {
        const agent = a[role] as Record<string, unknown>;
        if (!agent.model || typeof agent.model !== 'string') {
          errors.push(`agents.${role}.model is required`);
        } else if (!VALID_MODELS.includes(agent.model as string)) {
          errors.push(`agents.${role}.model "${agent.model}" is not a valid model`);
        }
      }
    }
  }
  if (!c.batching || typeof c.batching !== 'object') {
    errors.push('batching is required');
  } else {
    const b = c.batching as Record<string, unknown>;
    if (typeof b.filesPerBatch !== 'number' || b.filesPerBatch < 1 || b.filesPerBatch > 100) {
      errors.push('batching.filesPerBatch must be a number between 1 and 100');
    }
    if (typeof b.parallelBatches !== 'number' || b.parallelBatches < 1) {
      errors.push('batching.parallelBatches must be a positive number');
    }
  }
  return errors;
}

function isValidGlob(pattern: string): boolean {
  if (!pattern || pattern.trim().length === 0) return false;
  try {
    // Check for basic glob syntax validity
    let depth = 0;
    for (const ch of pattern) {
      if (ch === '[') depth++;
      if (ch === ']') depth--;
      if (depth < 0) return false;
    }
    return depth === 0;
  } catch {
    return false;
  }
}
