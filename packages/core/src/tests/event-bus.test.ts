import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EventBus } from '../shared/event-bus.js';
import type { DomainEvent, EventHandler } from '../shared/event-bus.js';

describe('EventBus', () => {
  beforeEach(() => {
    const bus = EventBus.getInstance();
    bus.clearDeadLetterQueue();
  });

  it('publish runs subscribed handlers', async () => {
    const bus = EventBus.getInstance();
    const handler: EventHandler = {
      handle: jest.fn(async () => {})
    };
    bus.subscribe('GamePublishedForAll', handler);

    const event: DomainEvent = {
      type: 'GamePublishedForAll',
      occurredAt: new Date(),
      id: '1',
      payload: { gameId: '00000000-0000-4000-8000-000000000001' },
    };

    await bus.publish(event);

    expect(handler.handle).toHaveBeenCalled();
  });

  it(
    'stores failed handlers in dead letter queue',
    async () => {
      const bus = EventBus.getInstance();
      bus.clearDeadLetterQueue();

      const failing: EventHandler = {
        handle: jest.fn(async () => {
          throw new Error('fail');
        })
      };
      bus.subscribe('GameClosed', failing);

      const event: DomainEvent = {
        type: 'GameClosed',
        occurredAt: new Date(),
        id: '2',
        payload: { gameId: '00000000-0000-4000-8000-000000000002' },
      };

      await bus.publish(event);

      expect(bus.getDeadLetterQueue().length).toBeGreaterThanOrEqual(1);
    },
    20000
  );

  it('clearDeadLetterQueue empties queue', async () => {
    const bus = EventBus.getInstance();
    bus.clearDeadLetterQueue();
    expect(bus.getDeadLetterQueue().length).toBe(0);
  });
});
