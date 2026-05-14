import { DomainEvent as TypedDomainEvent } from './types.js';
import { LoggerFactory } from './layer-logger.js';
import { LOG_MESSAGES } from './logging-messages.js';
import { recordDomainEventToOutbox } from '../infrastructure/messaging-outbox-record.js';
import type { Prisma } from '@prisma/client';

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
      return;
    }

    if (process.env.OUTBOX_RECORD_ENABLED === 'true') {
      try {
        const typed = event as TypedDomainEvent & { occurredAt: Date };
        await recordDomainEventToOutbox(
          { type: event.type, occurredAt: event.occurredAt, payload: typed.payload },
          null
        );
      } catch (err) {
        logger.warn('publish', 'messaging_outbox_record_failed', {
          eventType: event.type,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /** Запись outbox внутри уже открытой Prisma interactive-транзакции (без in-process handlers). */
  async appendOutbox(tx: unknown, event: DomainEvent): Promise<void> {
    if (process.env.OUTBOX_RECORD_ENABLED !== 'true') {
      return;
    }
    try {
      const typed = event as TypedDomainEvent & { occurredAt: Date };
      await recordDomainEventToOutbox(
        { type: event.type, occurredAt: event.occurredAt, payload: typed.payload },
        null,
        tx as Prisma.TransactionClient
      );
    } catch (err) {
      logger.warn('appendOutbox', 'messaging_outbox_record_failed', {
        eventType: event.type,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  /** In-process handlers только (после успешного коммита бизнес-транзакции). */
  async dispatchHandlers(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    const results = await Promise.allSettled(
      handlers.map(handler => this.handleWithRetry(handler, event))
    );
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error('dispatchHandlers', LOG_MESSAGES.INFRASTRUCTURE_SERVICES.EVENT_BUS_PROCESSING_FAILURES, new Error('Event processing failed'), {
        eventType: event.type,
        failures: failures.length,
        totalHandlers: handlers.length,
      });
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