import { DomainEvent as TypedDomainEvent } from './types.js';

export type DomainEvent = TypedDomainEvent & {
  occurredAt: Date;
  id?: string;
};

export interface EventHandler {
  handle(event: DomainEvent): Promise<void>;
}

export class EventBus {
  private handlers = new Map<string, EventHandler[]>();
  private deadLetterQueue: DomainEvent[] = [];

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    logger.info('Publishing event via EventBus', { eventType: event.type, eventId: event.id });
    const handlers = this.handlers.get(event.type) || [];

    const results = await Promise.allSettled(
      handlers.map(handler => this.handleWithRetry(handler, event))
    );

    // Проверяем неуспешную обработку
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error('Event processing failures', {
        eventType: event.type,
        failures: failures.length,
        totalHandlers: handlers.length
      });

      // Отправляем в dead letter queue
      this.deadLetterQueue.push(event);
    }
  }

  private async handleWithRetry(handler: EventHandler, event: DomainEvent, maxRetries = 3): Promise<void> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await handler.handle(event);
        return;
      } catch (error) {
        logger.warn('Event handler failed', {
          eventType: event.type,
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  getDeadLetterQueue(): DomainEvent[] {
    return [...this.deadLetterQueue];
  }

  clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
  }
}

// Импорт logger для использования в EventBus
import { logger } from './logger.js';