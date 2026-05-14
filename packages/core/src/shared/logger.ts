/**
 * Simple logger for the application
 */
export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

class ConsoleLogger implements Logger {
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${new Date().toISOString()} ${message}`, meta ? this.safeStringify(meta) : '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${new Date().toISOString()} ${message}`, meta ? this.safeStringify(meta) : '');
  }

  error(message: string, meta?: any): void {
    console.error(`[ERROR] ${new Date().toISOString()} ${message}`, meta ? this.safeStringify(meta) : '');
  }

  private safeStringify(obj: any): string {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
  }
}

export const logger: Logger = new ConsoleLogger();