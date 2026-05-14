import { describe, expect, it } from '@jest/globals';
import { buildEnvelope, inferAggregateIdFromPayload } from '../../../shared-kernel/src/index.js';

describe('shared-kernel envelope', () => {
  it('builds envelope with schema version', () => {
    const payload = { gameId: 'g1', userId: 'u1', status: 'confirmed' };
    const e = buildEnvelope({
      eventType: 'PlayerJoined',
      payload,
      occurredAt: new Date('2026-05-14T12:00:00.000Z'),
      correlationId: 'c1',
      aggregateId: inferAggregateIdFromPayload('PlayerJoined', payload),
    });
    expect(e.schemaVersion).toBe(1);
    expect(e.eventType).toBe('PlayerJoined');
    expect(e.aggregateId).toBe('g1');
  });

  it('serializes bigint in payload for JSON safety', () => {
    const payload = { gameId: 'g', telegramId: 123n };
    const safe = JSON.parse(JSON.stringify(payload, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
    const e = buildEnvelope({
      eventType: 'GameCreatedWithPriorityWindow',
      payload: safe,
      occurredAt: new Date(),
    });
    expect(e.payload).toEqual({ gameId: 'g', telegramId: '123' });
  });

  it('infers aggregate from gameId', () => {
    expect(inferAggregateIdFromPayload('X', { gameId: 'abc' })).toBe('abc');
  });
});
