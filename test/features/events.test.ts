import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationEventBus } from '../../src/events/bus';
import type { MigrationEvent } from '../../src/types/migration';

describe('MigrationEventBus', () => {
  let bus: MigrationEventBus;

  beforeEach(() => {
    bus = new MigrationEventBus();
  });

  it('should emit migration events', () => {
    const received: MigrationEvent[] = [];
    bus.on('file-started', (e) => received.push(e));
    bus.on('file-completed', (e) => received.push(e));
    bus.on('batch-completed', (e) => received.push(e));
    bus.on('migration-completed', (e) => received.push(e));

    bus.emit({ type: 'file-started', filePath: 'a.js', timestamp: 1 });
    bus.emit({ type: 'file-completed', filePath: 'a.js', status: 'migrated', timestamp: 2 });
    bus.emit({ type: 'batch-completed', batchId: 'b1', timestamp: 3 });
    bus.emit({ type: 'migration-completed', timestamp: 4 });

    expect(received).toHaveLength(4);
    expect(received.map(e => e.type)).toEqual([
      'file-started', 'file-completed', 'batch-completed', 'migration-completed'
    ]);
  });

  it('should subscribe and receive events in order', () => {
    const order: number[] = [];
    bus.on('test-event', (e) => order.push(e.timestamp));

    bus.emit({ type: 'test-event', timestamp: 10 });
    bus.emit({ type: 'test-event', timestamp: 20 });
    bus.emit({ type: 'test-event', timestamp: 30 });

    expect(order).toEqual([10, 20, 30]);
  });

  it('should include event metadata', () => {
    let captured: MigrationEvent | null = null;
    bus.on('file-completed', (e) => { captured = e; });

    bus.emit({
      type: 'file-completed',
      filePath: 'src/app.js',
      status: 'failed',
      error: 'Parse error on line 42',
      batchId: 'batch-1',
      timestamp: 100,
    });

    expect(captured).not.toBeNull();
    expect(captured!.filePath).toBe('src/app.js');
    expect(captured!.status).toBe('failed');
    expect(captured!.error).toBe('Parse error on line 42');
    expect(captured!.batchId).toBe('batch-1');
  });

  it('should support onAny for all events', () => {
    const all: string[] = [];
    bus.onAny((e) => all.push(e.type));

    bus.emit({ type: 'file-started', timestamp: 1 });
    bus.emit({ type: 'batch-completed', timestamp: 2 });
    bus.emit({ type: 'migration-completed', timestamp: 3 });

    expect(all).toEqual(['file-started', 'batch-completed', 'migration-completed']);
  });

  it('should unsubscribe handlers with off', () => {
    const events: MigrationEvent[] = [];
    const handler = (e: MigrationEvent) => events.push(e);
    bus.on('test', handler);

    bus.emit({ type: 'test', timestamp: 1 });
    expect(events).toHaveLength(1);

    bus.off('test', handler);
    bus.emit({ type: 'test', timestamp: 2 });
    expect(events).toHaveLength(1);
  });

  it('should keep event log', () => {
    bus.emit({ type: 'a', timestamp: 1 });
    bus.emit({ type: 'b', timestamp: 2 });
    const log = bus.getEventLog();
    expect(log).toHaveLength(2);
    expect(log[0].type).toBe('a');
    expect(log[1].type).toBe('b');
  });
});
