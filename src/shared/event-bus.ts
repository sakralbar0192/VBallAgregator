import { DomainEvent as TypedDomainEvent } from './types.js';
import { LoggerFactory } from './layer-logger.js';
import { LOG_MESSAGES } from './logging-messages.js';

export type DomainEvent = TypedDomainEvent & {
  occurredAt: Date;
  id?: string;
};

export interface EventHandler {
  handle(event: DomainEvent): Promise<void>;
}

export class EventBus {
  private static instance: EventBus;
  private handlers = new Map<string, EventHandler[]>();
  private deadLetterQueue: DomainEvent[] = [];

  private constructor() {}

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    logger.info('publish', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.EVENT_BUS_PUBLISHING, { eventType: event.type, eventId: event.id });
    const handlers = this.handlers.get(event.type) || [];

    console.log('handlers', handlers)

    const results = await Promise.allSettled(
      handlers.map(handler => this.handleWithRetry(handler, event))
    );

    // Проверяем неуспешную обработку
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error('publish', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.EVENT_BUS_PROCESSING_FAILURES, new Error('Event processing failed'), {
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
        logger.warn('handleEvent', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.EVENT_BUS_HANDLER_FAILED, {
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

const logger = LoggerFactory.external('event-bus');