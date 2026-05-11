import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createServer, getApiPort } from '../api/server.js';
import type { HealthCheckService } from '../infrastructure/health.js';

describe('API server', () => {
  let app: Awaited<ReturnType<typeof createServer>>;

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

  beforeEach(async () => {
    app = await createServer({ healthCheckService });
  });

  afterEach(async () => {
    await app.close();
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
});
