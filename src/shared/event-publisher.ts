import type { DomainEvent } from './types.js';
import { v4 as uuid } from 'uuid';

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export class InMemoryEventPublisher implements EventPublisher {
  private handlers = new Map<string, ((event: DomainEvent) => Promise<void>)[]>();

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    await Promise.all(handlers.map(handler => handler(event)));
  }
}

export const eventPublisher = new InMemoryEventPublisher();

export function evt<T extends DomainEvent>(type: T['type'], payload: T['payload']): T {
  return {
    type,
    occurredAt: new Date(),
    id: uuid(),
    payload
  } as T;
}