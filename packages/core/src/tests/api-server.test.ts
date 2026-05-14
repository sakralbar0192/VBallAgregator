import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createServer, getApiPort } from '../api/server.js';
import type { HealthCheckService } from '../infrastructure/health.js';
import type { PrismaClient } from '@prisma/client';

describe('API server', () => {
  let app: Awaited<ReturnType<typeof createServer>>;
  let prevToken: string | undefined;

  const healthCheckService: HealthCheckService = {
    async checkHealth() {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'up' },
        },
      };
    },
  } as unknown as HealthCheckService;

  const prismaMock = {
    user: {
      findUnique: jest.fn(),
    },
  } as unknown as PrismaClient;

  beforeEach(async () => {
    prevToken = process.env.INTERNAL_API_TOKEN;
    process.env.INTERNAL_API_TOKEN = 'test-internal-token';
    const userDelegate = prismaMock as unknown as { user: { findUnique: jest.Mock } };
    userDelegate.user.findUnique.mockReset();
    app = await createServer({ healthCheckService, prisma: prismaMock });
  });

  afterEach(async () => {
    await app.close();
    if (prevToken === undefined) {
      delete process.env.INTERNAL_API_TOKEN;
    } else {
      process.env.INTERNAL_API_TOKEN = prevToken;
    }
  });

  it('getApiPort returns sane default', () => {
    const prev = process.env.API_PORT;
    delete process.env.API_PORT;
    expect(getApiPort()).toBe(3001);
    process.env.API_PORT = '4000';
    expect(getApiPort()).toBe(4000);
    process.env.API_PORT = prev;
  });

  it('GET /health /health/ready /health/live and root', async () => {
    const live = await app.inject({ method: 'GET', url: '/health/live' });
    expect(live.statusCode).toBe(200);
    expect(JSON.parse(live.body).alive).toBe(true);

    const health = await app.inject({ method: 'GET', url: '/health' });
    expect(health.statusCode).toBe(200);

    const ready = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(ready.statusCode).toBe(200);

    const root = await app.inject({ method: 'GET', url: '/' });
    expect(root.statusCode).toBe(200);
    expect(JSON.parse(root.body).status).toBe('running');
  });

  it('GET /internal/users/by-telegram/:id requires bearer', async () => {
    const res = await app.inject({ method: 'GET', url: '/internal/users/by-telegram/123' });
    expect(res.statusCode).toBe(401);
  });

  it('GET /internal/users/by-telegram/:id returns user when token ok', async () => {
    const userDelegate = prismaMock as unknown as { user: { findUnique: jest.Mock } };
    (userDelegate.user.findUnique as jest.Mock).mockImplementation(async () => ({
      id: 'u1',
      telegramId: 123n,
      name: 'Test',
      levelTag: null,
      activeSport: 'volleyball',
    }));

    const res = await app.inject({
      method: 'GET',
      url: '/internal/users/by-telegram/123',
      headers: { authorization: 'Bearer test-internal-token' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { userId: string; telegramId: string; name: string };
    expect(body.userId).toBe('u1');
    expect(body.telegramId).toBe('123');
    expect(body.name).toBe('Test');
  });
});
