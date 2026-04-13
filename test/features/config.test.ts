import { describe, it, expect } from 'vitest';
import type { MigrationConfig } from '../../src/types/config';
import { validateMigrationConfig } from '../../src/config/loader';

describe('MigrationConfig', () => {
  it('should load and validate required fields', () => {
    // TODO: Test MigrationConfig loads from JSON and validates required fields
  });

  it('should reject invalid agent models', () => {
    // TODO: Test schema validation rejects configs with invalid agent models
  });

  it('should validate source/target patterns are valid globs', () => {
    // TODO: Test that source/target patterns are valid glob expressions
  });

  it('should enforce batch size constraints', () => {
    // TODO: Test batch size constraints (1-100 files per batch)
  });
});
