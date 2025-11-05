/**
 * Улучшенная система логирования с учетом архитектурных слоев
 * Предоставляет структурированное логирование для многослойных приложений
 */

/**
 * Архитектурные слои в приложении
 */
export enum ArchitectureLayer {
  PRESENTATION = 'PRESENTATION',    // Обработчики ботов, контроллеры API
  APPLICATION = 'APPLICATION',      // Use cases, сервисы приложения
  DOMAIN = 'DOMAIN',               // Доменные сервисы, сущности, объекты-значения
  INFRASTRUCTURE = 'INFRASTRUCTURE', // Репозитории, внешние сервисы
  CROSS_CUTTING = 'CROSS_CUTTING'   // Шина событий, уведомления, метрики
}

/**
 * Контекстная информация для операций логирования
 */
export interface LogContext {
  /** Архитектурный слой, в котором происходит операция */
  layer: ArchitectureLayer;
  /** Компонент системы (bot, user-service, game-repo и т.д.) */
  component: string;
  /** Название операции (registerUser, createGame, upsertUser) */
  operation: string;
  /** Идентификатор пользователя */
  userId?: string;
  /** Идентификатор игры */
  gameId?: string;
  /** Telegram ID пользователя */
  telegramId?: string | number;
  /** Корреляционный ID для трассировки цепочек операций */
  correlationId?: string;
  /** Временная метка операции */
  timestamp?: string;
  /** Время выполнения операции в миллисекундах */
  executionTimeMs?: number;
}

/**
 * Структурированная запись лога
 */
export interface StructuredLog {
  /** Уровень логирования */
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  /** Временная метка в формате ISO */
  timestamp: string;
  /** Архитектурный слой */
  layer: string;
  /** Компонент системы */
  component: string;
  /** Название операции */
  operation: string;
  /** Текстовое сообщение */
  message: string;
  /** Контекст операции */
  context?: LogContext;
  /** Дополнительные метаданные */
  metadata?: Record<string, any>;
  /** Код ошибки */
  errorCode?: string;
  /** Стек-трейс ошибки */
  stackTrace?: string;
  /** Корреляционный ID */
  correlationId?: string;
  /** Время выполнения в миллисекундах */
  executionTimeMs?: number;
}

/**
 * Базовый интерфейс логгера
 */
export interface Logger {
  /**
   * Логирует информационное сообщение
   * @param message - Текстовое сообщение
   * @param meta - Дополнительные метаданные
   */
  info(message: string, meta?: any): void;

  /**
   * Логирует предупреждение
   * @param message - Текстовое сообщение
   * @param meta - Дополнительные метаданные
   */
  warn(message: string, meta?: any): void;

  /**
   * Логирует ошибку
   * @param message - Текстовое сообщение
   * @param meta - Дополнительные метаданные
   */
  error(message: string, meta?: any): void;

  /**
   * Логирует отладочное сообщение (только в режиме разработки)
   * @param message - Текстовое сообщение
   * @param meta - Дополнительные метаданные
   */
  debug(message: string, meta?: any): void;

  /**
   * Логирует структурированную запись
   * @param entry - Структурированная запись лога
   */
  log(entry: StructuredLog): void;
}

/**
 * Утилиты для отслеживания производительности операций
 */
export class PerformanceTracker {
  private startTime = Date.now();
  private data: Record<string, any> = {};

  /**
   * Устанавливает метаданные для операции
   * @param key - Ключ метаданных
   * @param value - Значение метаданных
   * @returns Текущий экземпляр PerformanceTracker для цепочки вызовов
   */
  set(key: string, value: any): this {
    this.data[key] = value;
    return this;
  }

  /**
   * Завершает отслеживание и возвращает метрики
   * @returns Объект с продолжительностью выполнения и метаданными
   */
  end(): { duration: number; metadata: Record<string, any> } {
    const duration = Date.now() - this.startTime;
    return {
      duration,
      metadata: { ...this.data }
    };
  }
}

/**
 * Генератор корреляционных ID для трассировки операций
 * @returns Уникальный корреляционный ID
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Создает контекст логирования с корреляционным ID
 * @param layer - Архитектурный слой
 * @param component - Компонент системы
 * @param operation - Название операции
 * @param additionalData - Дополнительные данные контекста
 * @returns Объект контекста логирования
 */
export function createLogContext(
  layer: ArchitectureLayer,
  component: string,
  operation: string,
  additionalData?: Partial<LogContext>
): LogContext {
  return {
    layer,
    component,
    operation,
    timestamp: new Date().toISOString(),
    correlationId: generateCorrelationId(),
    ...additionalData
  };
}

/**
 * Улучшенный консольный логгер со структурированным выводом
 */
export class EnhancedConsoleLogger implements Logger {
  /**
   * Форматирует запись лога в строку для вывода
   * @param entry - Структурированная запись лога
   * @returns Отформатированная строка лога
   * @private
   */
  private formatLog(entry: StructuredLog): string {
    const context = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : '';
    const metadata = entry.metadata ? ` | Meta: ${JSON.stringify(entry.metadata)}` : '';
    const executionTime = entry.executionTimeMs ? ` | Duration: ${entry.executionTimeMs}ms` : '';

    return `[${entry.level}] ${entry.timestamp} [${entry.layer}] ${entry.component}.${entry.operation}: ${entry.message}${context}${metadata}${executionTime}`;
  }

  /**
   * Логирует структурированную запись
   * @param entry - Структурированная запись лога
   */
  log(entry: StructuredLog): void {
    const formattedMessage = this.formatLog(entry);

    switch (entry.level) {
      case 'INFO':
        console.log(formattedMessage);
        break;
      case 'WARN':
        console.warn(formattedMessage);
        break;
      case 'ERROR':
        console.error(formattedMessage);
        break;
      case 'DEBUG':
        if (process.env.NODE_ENV === 'development') {
          console.debug(formattedMessage);
        }
        break;
    }

    // В продакшене можно отправлять на внешний сервис логирования
    if (process.env.NODE_ENV === 'production' && entry.level === 'ERROR') {
      this.sendToExternalService(entry);
    }
  }

  /**
   * Логирует информационное сообщение
   * @param message - Текстовое сообщение
   * @param meta - Дополнительные метаданные
   */
  info(message: string, meta?: any): void {
    this.log({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      layer: 'UNKNOWN',
      component: 'console',
      operation: 'unknown',
      message,
      metadata: this.serializeMetadata(meta)
    });
  }

  /**
   * Логирует предупреждение
   * @param message - Текстовое сообщение
   * @param meta - Дополнительные метаданные
   */
  warn(message: string, meta?: any): void {
    this.log({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      layer: 'UNKNOWN',
      component: 'console',
      operation: 'unknown',
      message,
      metadata: this.serializeMetadata(meta)
    });
  }

  /**
   * Логирует ошибку
   * @param message - Текстовое сообщение
   * @param meta - Дополнительные метаданные
   */
  error(message: string, meta?: any): void {
    const metadata = this.serializeMetadata(meta);
    const errorInfo = metadata?.error;

    this.log({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      layer: 'UNKNOWN',
      component: 'console',
      operation: 'unknown',
      message,
      metadata,
      errorCode: errorInfo?.code,
      stackTrace: errorInfo?.stack
    });
  }

  /**
   * Логирует отладочное сообщение (только в режиме разработки)
   * @param message - Текстовое сообщение
   * @param meta - Дополнительные метаданные
   */
  debug(message: string, meta?: any): void {
    this.log({
      level: 'DEBUG',
      timestamp: new Date().toISOString(),
      layer: 'UNKNOWN',
      component: 'console',
      operation: 'unknown',
      message,
      metadata: this.serializeMetadata(meta)
    });
  }

  /**
   * Сериализует метаданные для логирования
   * @param meta - Метаданные для сериализации
   * @returns Сериализованные метаданные
   * @private
   */
  private serializeMetadata(meta: any): Record<string, any> {
    if (!meta) return {};

    if (typeof meta === 'object') {
      return JSON.parse(JSON.stringify(meta, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ));
    }

    return { value: meta };
  }

  /**
   * Отправляет запись на внешний сервис логирования
   * @param entry - Структурированная запись лога
   * @private
   */
  private sendToExternalService(entry: StructuredLog): void {
    // Заглушка для интеграции с внешним сервисом логирования
    // Примеры: CloudWatch, Datadog, LogDNA, etc.
    console.log('Внешний сервис логирования получит:', entry);
  }
}

// Экспорт экземпляра улучшенного логгера по умолчанию
export const enhancedLogger: Logger = new EnhancedConsoleLogger();