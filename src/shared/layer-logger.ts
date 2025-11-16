/**
 * Логгер для конкретного архитектурного слоя
 * Предоставляет структурированное логирование с учетом контекста каждого архитектурного слоя
 */

import {
  Logger,
  LogContext,
  generateCorrelationId,
  ArchitectureLayer,
  enhancedLogger
} from './enhanced-logger.js';

/**
 * Логгер, специализированный для конкретного архитектурного слоя
 */
export class LayerLogger {
  private readonly layer: ArchitectureLayer;
  private readonly component: string;
  private readonly baseLogger: Logger;
  private defaultCorrelationId?: string;

  /**
   * Создает экземпляр логгера для архитектурного слоя
   * @param layer - Архитектурный слой
   * @param component - Компонент системы
   * @param logger - Базовый логгер (по умолчанию enhancedLogger)
   */
  constructor(
    layer: ArchitectureLayer,
    component: string,
    logger: Logger = enhancedLogger
  ) {
    this.layer = layer;
    this.component = component;
    this.baseLogger = logger;
  }

  /**
   * Устанавливает корреляционный ID по умолчанию для всех операций в этом экземпляре логгера
   * @param correlationId - Корреляционный ID для трассировки операций
   * @returns Текущий экземпляр логгера для цепочки вызовов
   */
  withCorrelationId(correlationId: string): this {
    this.defaultCorrelationId = correlationId;
    return this;
  }

  /**
   * Создает обогащенный контекст с информацией о слое и компоненте
   * @param operation - Название операции
   * @param additionalData - Дополнительные данные контекста
   * @returns Обогащенный контекст логирования
   * @private
   */
  private createEnrichedContext(
    operation: string,
    additionalData?: Partial<LogContext>
  ): LogContext {
    return {
      layer: this.layer,
      component: this.component,
      operation,
      timestamp: new Date().toISOString(),
      correlationId: this.defaultCorrelationId || generateCorrelationId(),
      ...additionalData
    };
  }

  /**
   * Логирует информационное сообщение с полным контекстом
   * @param operation - Название операции
   * @param message - Текстовое сообщение
   * @param metadata - Дополнительные метаданные
   * @param context - Дополнительный контекст логирования
   */
  info(
    operation: string,
    message: string,
    metadata?: Record<string, any>,
    context?: Partial<LogContext>
  ): void {
    const enrichedContext = this.createEnrichedContext(operation, context);
    this.baseLogger.log({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      layer: this.layer,
      component: this.component,
      operation,
      message,
      context: enrichedContext,
      metadata,
      correlationId: enrichedContext.correlationId
    });
  }

  /**
   * Логирует предупреждение с полным контекстом
   * @param operation - Название операции
   * @param message - Текстовое сообщение
   * @param metadata - Дополнительные метаданные
   * @param context - Дополнительный контекст логирования
   */
  warn(
    operation: string,
    message: string,
    metadata?: Record<string, any>,
    context?: Partial<LogContext>
  ): void {
    const enrichedContext = this.createEnrichedContext(operation, context);
    this.baseLogger.log({
      level: 'WARN',
      timestamp: new Date().toISOString(),
      layer: this.layer,
      component: this.component,
      operation,
      message,
      context: enrichedContext,
      metadata,
      correlationId: enrichedContext.correlationId
    });
  }

  /**
   * Логирует ошибку с полным контекстом и деталями ошибки
   * @param operation - Название операции
   * @param message - Текстовое сообщение
   * @param error - Объект ошибки
   * @param metadata - Дополнительные метаданные
   * @param context - Дополнительный контекст логирования
   */
  error(
    operation: string,
    message: string,
    error?: Error,
    metadata?: Record<string, any>,
    context?: Partial<LogContext>
  ): void {
    const enrichedContext = this.createEnrichedContext(operation, context);
    this.baseLogger.log({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      layer: this.layer,
      component: this.component,
      operation,
      message,
      context: enrichedContext,
      metadata,
      errorCode: error?.name,
      stackTrace: error?.stack,
      correlationId: enrichedContext.correlationId
    });
  }

  /**
   * Логирует отладочное сообщение (только в режиме разработки)
   * @param operation - Название операции
   * @param message - Текстовое сообщение
   * @param metadata - Дополнительные метаданные
   * @param context - Дополнительный контекст логирования
   */
  debug(
    operation: string,
    message: string,
    metadata?: Record<string, any>,
    context?: Partial<LogContext>
  ): void {
    const enrichedContext = this.createEnrichedContext(operation, context);
    this.baseLogger.log({
      level: 'DEBUG',
      timestamp: new Date().toISOString(),
      layer: this.layer,
      component: this.component,
      operation,
      message,
      context: enrichedContext,
      metadata,
      correlationId: enrichedContext.correlationId
    });
  }

  /**
   * Создает трекер производительности для измерения длительности операции
   * @param operation - Название операции
   * @param metadata - Начальные метаданные
   * @returns Объект трекера производительности
   */
  startTracking(operation: string, metadata?: Record<string, any>) {
    const startTime = Date.now();
    const data: Record<string, any> = { ...metadata };

    // Логируем начало операции
    this.info(operation, 'Операция начата', metadata);

    return {
      /**
       * Устанавливает дополнительное значение метаданных
       * @param key - Ключ метаданных
       * @param value - Значение метаданных
       * @returns Текущий трекер для цепочки вызовов
       */
      set: (key: string, value: any) => {
        data[key] = value;
        return this;
      },
      /**
       * Завершает отслеживание и логирует завершение операции
       * @returns Метрики выполнения операции
       */
      end: () => {
        const duration = Date.now() - startTime;
        this.info(operation, 'Операция завершена',
          { ...data, executionTimeMs: duration },
          { executionTimeMs: duration }
        );
        return { duration, metadata: data };
      }
    };
  }

  /**
   * Логирует операцию с автоматическим отслеживанием производительности
   * @param operation - Название операции
   * @param operationFn - Функция операции для выполнения
   * @param context - Дополнительный контекст логирования
   * @param metadata - Дополнительные метаданные
   * @returns Результат выполнения операции
   */
  async logOperation<T>(
    operation: string,
    operationFn: () => Promise<T>,
    context?: Partial<LogContext>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const tracker = this.startTracking(operation, metadata);

    try {
      const result = await operationFn();
      tracker.end();
      return result;
    } catch (error) {
      tracker.end();
      this.error(operation, 'Операция не удалась', error as Error, metadata, context);
      throw error;
    }
  }

  /**
   * Логирует точку входа для кросс-слоевых операций
   * @param operation - Название операции
   * @param data - Дополнительные данные
   */
  entry(operation: string, data?: Record<string, any>): void {
    this.info(operation, 'Вход в операцию', data);
  }

  /**
   * Логирует точку выхода для кросс-слоевых операций
   * @param operation - Название операции
   * @param data - Дополнительные данные
   */
  exit(operation: string, data?: Record<string, any>): void {
    this.info(operation, 'Выход из операции', data);
  }

  /**
   * Логирует валидацию бизнес-правила
   * @param operation - Название операции
   * @param rule - Описание правила валидации
   * @param passed - Прошло ли правило валидацию
   * @param details - Дополнительные детали валидации
   */
  validation(
    operation: string,
    rule: string,
    passed: boolean,
    details?: Record<string, any>
  ): void {
    const message = passed ? 'Бизнес-правило пройдено' : 'Бизнес-правило не пройдено';
    const metadata = { rule, passed, ...details };

    if (passed) {
      this.debug(operation, message, metadata);
    } else {
      this.warn(operation, message, metadata);
    }
  }

  /**
   * Логирует операцию базы данных
   * @param operation - Название операции
   * @param table - Название таблицы
   * @param action - Действие (SELECT, INSERT, UPDATE, DELETE)
   * @param data - Данные операции
   * @param duration - Время выполнения в миллисекундах
   */
  database(
    operation: string,
    table: string,
    action: string,
    data?: Record<string, any>,
    duration?: number
  ): void {
    const metadata = { table, action, ...data };
    const context = { executionTimeMs: duration };

    this.debug(operation, `База данных ${action} на ${table}`, metadata, context);
  }

  /**
   * Логирует взаимодействие с внешним сервисом
   * @param operation - Название операции
   * @param service - Название внешнего сервиса
   * @param action - Действие с сервисом
   * @param success - Успешно ли выполнение
   * @param duration - Время выполнения в миллисекундах
   * @param error - Объект ошибки (если выполнение не удалось)
   */
  external(
    operation: string,
    service: string,
    action: string,
    success: boolean,
    duration?: number,
    error?: Error
  ): void {
    const message = success
      ? `Внешний сервис ${service} ${action} выполнен успешно`
      : `Внешний сервис ${service} ${action} не удался`;

    const metadata = { service, action, success };
    const context = { executionTimeMs: duration };

    if (success) {
      this.info(operation, message, metadata, context);
    } else {
      this.error(operation, message, error, metadata, context);
    }
  }

  /**
   * Создает новый экземпляр логгера с измененным контекстом
   * @param additionalComponent - Дополнительный компонент для имени
   * @returns Новый экземпляр LayerLogger
   */
  child(additionalComponent: string): LayerLogger {
    return new LayerLogger(
      this.layer,
      `${this.component}.${additionalComponent}`,
      this.baseLogger
    ).withCorrelationId(this.defaultCorrelationId || '');
  }
}

/**
 * Предварительно настроенные логгеры для каждого архитектурного слоя
 */

// Логгер уровня представления (обработчики ботов, контроллеры API)
export const presentationLogger = new LayerLogger(
  ArchitectureLayer.PRESENTATION,
  'telegram-bot'
);

// Логгер уровня приложения (use cases, сервисы приложения)
export const applicationLogger = new LayerLogger(
  ArchitectureLayer.APPLICATION,
  'application'
);

// Логгер доменного уровня (доменные сервисы, сущности)
export const domainLogger = new LayerLogger(
  ArchitectureLayer.DOMAIN,
  'domain'
);

// Логгер уровня инфраструктуры (репозитории, внешние сервисы)
export const infrastructureLogger = new LayerLogger(
  ArchitectureLayer.INFRASTRUCTURE,
  'infrastructure'
);

// Логгер кросс-слоевых компонентов (шина событий, уведомления, метрики)
export const crossCuttingLogger = new LayerLogger(
  ArchitectureLayer.CROSS_CUTTING,
  'cross-cutting'
);

/**
 * Специализированная фабрика логгеров для компонентов
 */
export class LoggerFactory {
  /**
   * Создает логгер для обработчиков ботов
   * @param component - Название компонента бота
   * @returns Экземпляр LayerLogger для уровня представления
   */
  static bot(component: string): LayerLogger {
    return new LayerLogger(ArchitectureLayer.PRESENTATION, `bot.${component}`);
  }

  /**
   * Создает логгер для use cases
   * @param useCase - Название use case
   * @returns Экземпляр LayerLogger для уровня приложения
   */
  static useCase(useCase: string): LayerLogger {
    return new LayerLogger(ArchitectureLayer.APPLICATION, `use-case.${useCase}`);
  }

  /**
   * Создает логгер для сервисов приложения
   * @param service - Название сервиса
   * @returns Экземпляр LayerLogger для уровня приложения
   */
  static service(service: string): LayerLogger {
    return new LayerLogger(ArchitectureLayer.APPLICATION, `service.${service}`);
  }

  /**
   * Создает логгер для доменных сервисов
   * @param service - Название доменного сервиса
   * @returns Экземпляр LayerLogger для доменного уровня
   */
  static domainService(service: string): LayerLogger {
    return new LayerLogger(ArchitectureLayer.DOMAIN, `domain-service.${service}`);
  }

  /**
   * Создает логгер для репозиториев
   * @param repo - Название репозитория
   * @returns Экземпляр LayerLogger для уровня инфраструктуры
   */
  static repository(repo: string): LayerLogger {
    return new LayerLogger(ArchitectureLayer.INFRASTRUCTURE, `repository.${repo}`);
  }

  /**
   * Создает логгер для внешних интеграций
   * @param service - Название внешнего сервиса
   * @returns Экземпляр LayerLogger для уровня инфраструктуры
   */
  static external(service: string): LayerLogger {
    return new LayerLogger(ArchitectureLayer.INFRASTRUCTURE, `external.${service}`);
  }
}