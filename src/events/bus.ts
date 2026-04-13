import type { MigrationEvent } from '../types/migration';

export type MigrationEventHandler = (event: MigrationEvent) => void;

export class MigrationEventBus {
  private handlers = new Map<string, Set<MigrationEventHandler>>();
  private allHandlers = new Set<MigrationEventHandler>();
  private eventLog: MigrationEvent[] = [];

  emit(event: MigrationEvent): void {
    const enriched = { ...event, timestamp: event.timestamp || Date.now() };
    this.eventLog.push(enriched);
    const typeHandlers = this.handlers.get(enriched.type);
    if (typeHandlers) {
      for (const handler of typeHandlers) handler(enriched);
    }
    for (const handler of this.allHandlers) handler(enriched);
  }

  on(eventType: string, handler: MigrationEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  onAny(handler: MigrationEventHandler): void {
    this.allHandlers.add(handler);
  }

  off(eventType: string, handler: MigrationEventHandler): void {
    const typeHandlers = this.handlers.get(eventType);
    if (typeHandlers) typeHandlers.delete(handler);
  }

  offAny(handler: MigrationEventHandler): void {
    this.allHandlers.delete(handler);
  }

  getEventLog(): MigrationEvent[] {
    return [...this.eventLog];
  }

  clear(): void {
    this.handlers.clear();
    this.allHandlers.clear();
    this.eventLog = [];
  }
}
