import { prisma } from './prisma.js';
import { SchedulerService } from '../shared/scheduler-service.js';
import { config } from '../shared/config.js';
import { logger } from '../shared/logger.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: Record<string, CheckResult>;
  timestamp: string;
}

export interface CheckResult {
  status: 'up' | 'down';
  responseTime?: number;
  error?: string;
  details?: any;
}

export class HealthCheckService {
  constructor(
    private prismaClient: any,
    private redisClient: any,
    private schedulerService: SchedulerService
  ) {}

  async checkHealth(): Promise<HealthStatus> {
    const start = Date.now();
    const checks: Record<string, CheckResult> = {};

    // Параллельные проверки
    const [db, redis, queues, telegram] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkQueues(),
      this.checkTelegramAPI(),
    ]);

    checks.database = this.processCheckResult(db);
    checks.redis = this.processCheckResult(redis);
    checks.queues = this.processCheckResult(queues);
    checks.telegram = this.processCheckResult(telegram);

    const overallStatus = this.calculateOverallStatus(checks);

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.prismaClient.$queryRaw`SELECT 1`;
      return {
        status: 'up',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }
  }

  private async checkRedis(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const result = await this.redisClient.ping();
      return {
        status: result === 'PONG' ? 'up' : 'down',
        responseTime: Date.now() - start,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Redis connection failed',
      };
    }
  }

  private async checkQueues(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const stats = await this.schedulerService.getQueueStats();
      const hasStalled = stats.reminderStats.failed.length > 10 || stats.paymentStats.failed.length > 10;

      return {
        status: hasStalled ? 'down' : 'up',
        responseTime: Date.now() - start,
        details: stats,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Queue check failed',
      };
    }
  }

  private async checkTelegramAPI(): Promise<CheckResult> {
    const start = Date.now();
    try {
      // Простой запрос к API Telegram
      const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/getMe`);
      const isOk = response.ok;

      return {
        status: isOk ? 'up' : 'down',
        responseTime: Date.now() - start,
        details: isOk ? undefined : await response.text(),
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - start,
        error: error instanceof Error ? error.message : 'Telegram API check failed',
      };
    }
  }

  private processCheckResult(result: PromiseSettledResult<CheckResult>): CheckResult {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        status: 'down',
        error: result.reason?.message || 'Check failed',
      };
    }
  }

  private calculateOverallStatus(checks: Record<string, CheckResult>): 'healthy' | 'degraded' | 'unhealthy' {
    const results = Object.values(checks);
    const downCount = results.filter(check => check.status === 'down').length;

    if (downCount === 0) return 'healthy';
    if (downCount === 1) return 'degraded';
    return 'unhealthy';
  }
}