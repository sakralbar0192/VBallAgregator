/**
 * Метрики доставки уведомлений
 */
export interface NotificationMetrics {
  sent: number;
  delivered: number;
  failed: number;
  retries: number;
}

export class NotificationTracker {
  private static metrics = new Map<string, NotificationMetrics>();

  static recordSent(type: string): void {
    const key = this.getKey(type);
    const current = this.metrics.get(key) || { sent: 0, delivered: 0, failed: 0, retries: 0 };
    current.sent++;
    this.metrics.set(key, current);
  }

  static recordDelivered(type: string): void {
    const key = this.getKey(type);
    const current = this.metrics.get(key) || { sent: 0, delivered: 0, failed: 0, retries: 0 };
    current.delivered++;
    this.metrics.set(key, current);
  }

  static recordFailed(type: string): void {
    const key = this.getKey(type);
    const current = this.metrics.get(key) || { sent: 0, delivered: 0, failed: 0, retries: 0 };
    current.failed++;
    this.metrics.set(key, current);
  }

  static recordRetry(type: string): void {
    const key = this.getKey(type);
    const current = this.metrics.get(key) || { sent: 0, delivered: 0, failed: 0, retries: 0 };
    current.retries++;
    this.metrics.set(key, current);
  }

  static getMetrics(type: string): NotificationMetrics {
    const key = this.getKey(type);
    return this.metrics.get(key) || { sent: 0, delivered: 0, failed: 0, retries: 0 };
  }

  static getAllMetrics(): Record<string, NotificationMetrics> {
    const result: Record<string, NotificationMetrics> = {};
    for (const [key, metrics] of this.metrics) {
      result[key] = { ...metrics };
    }
    return result;
  }

  static reset(): void {
    this.metrics.clear();
  }

  private static getKey(type: string): string {
    // Группируем по дням для агрегации
    const today = new Date().toISOString().split('T')[0];
    return `${type}_${today}`;
  }
}