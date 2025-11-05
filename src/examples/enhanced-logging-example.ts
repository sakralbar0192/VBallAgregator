/**
 * Example demonstrating enhanced logging system usage across all architecture layers
 * This file shows how to replace existing logging with the new enhanced system
 */

import { LoggerFactory } from '../shared/layer-logger.js';
import { ArchitectureLayer } from '../shared/enhanced-logger.js';

// ============================================================================
// 1. PRESENTATION LAYER - Bot Handlers
// ============================================================================

// Old way (simple console.log):
// console.log(`[INFO] User registered: ${telegramId}`);

// New way with enhanced logging:
const botLogger = LoggerFactory.bot('start-handler');

export async function handleUserStartCommand(ctx: any) {
  const telegramId = ctx.from.id;
  const name = ctx.from.first_name + (ctx.from.last_name ? ' ' + ctx.from.last_name : '');

  // Enhanced logging with correlation ID
  const correlationId = `start_${telegramId}_${Date.now()}`;

botLogger.info('handleUserStart', 'User initiated /start command',
  { telegramId, firstName: ctx.from.first_name },
  { correlationId, telegramId: Number(telegramId) }
);

  try {
    // Log entry into business logic
    botLogger.entry('registerUser', { telegramId, name, correlationId });

    // Call use case (this would use the enhanced logging internally)
    const result = await registerUserWithLogging(telegramId, name, correlationId);
    
    // Log successful completion
    botLogger.exit('registerUser', {
      userId: result.id,
      correlationId
    });

    // Log UI response
    botLogger.info('sendRoleSelection', 'Sending role selection interface',
      { userId: result.id },
      { correlationId }
    );

    return { userId: result.userId, correlationId };

  } catch (error) {
    botLogger.error('handleUserStart', 'Failed to process user start command', 
      error as Error,
      { telegramId, error: (error as Error).message },
      { correlationId }
    );
    throw error;
  }
}

// ============================================================================
// 2. APPLICATION LAYER - Use Cases
// ============================================================================

const useCaseLogger = LoggerFactory.useCase('registerUser');

export async function registerUserWithLogging(
  telegramId: number | bigint, 
  name: string, 
  correlationId: string
) {
  // Log use case entry
  useCaseLogger.info('registerUser', 'Processing user registration request',
    { telegramId, name },
    { correlationId }
  );

  // Use performance tracking
  const tracker = useCaseLogger.startTracking('registerUser', {
    telegramId,
    operation: 'user_registration'
  });

  try {
    // Simulate validation
    if (!telegramId || telegramId <= 0) {
      throw new Error('Invalid telegramId');
    }

    if (!name?.trim()) {
      throw new Error('Name cannot be empty');
    }

    tracker.set('validation', 'passed');

    // Log validation success
    useCaseLogger.validation('registerUser', 'Input validation', true, {
      telegramId,
      nameLength: name.length
    });

    // Call application service
    tracker.set('service_call', 'userApplicationService.registerUser');
    const result = await registerUserServiceCall(telegramId, name);

    tracker.set('result', 'success');
    tracker.set('userId', result.userId);

    // Log successful completion
    useCaseLogger.info('registerUser', 'User registration completed successfully',
      { userId: result.id },
      { correlationId }
    );

    return result;

  } catch (error) {
    useCaseLogger.validation('registerUser', 'Input validation', false, {
      telegramId,
      error: (error as Error).message
    });
    
    throw error;
  }
}

// ============================================================================
// 3. APPLICATION SERVICES LAYER
// ============================================================================

const serviceLogger = LoggerFactory.service('user-service');

export async function registerUserServiceCall(telegramId: number | bigint, name: string) {
  serviceLogger.info('registerUser', 'Invoking user repository operation',
    { telegramId: Number(telegramId) },
    { layer: ArchitectureLayer.APPLICATION, component: 'user-service' }
  );

  // Use database-specific logging
  serviceLogger.database('registerUser', 'users', 'UPSERT', {
    telegramId,
    name
  });

  try {
    const result = await simulateUserRepositoryUpsert(telegramId, name);
    
    serviceLogger.database('registerUser', 'users', 'UPSERT', {
      telegramId,
      operationResult: 'success'
    });

    return result;

  } catch (error) {
    serviceLogger.database('registerUser', 'users', 'UPSERT', {
      telegramId,
      operationResult: 'failed',
      error: (error as Error).message
    });
    throw error;
  }
}

// ============================================================================
// 4. INFRASTRUCTURE LAYER - Repositories
// ============================================================================

const repositoryLogger = LoggerFactory.repository('prisma-user-repo');

export async function simulateUserRepositoryUpsert(telegramId: number | bigint, name: string) {
  repositoryLogger.info('upsertUser', 'Executing database upsert operation',
    { telegramId, name },
    {}
  );

  // Track performance for database operation
  const dbTracker = repositoryLogger.startTracking('upsertUser', {
    table: 'users',
    operation: 'UPSERT',
    telegramId
  });

  try {
    // Simulate database operation
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    const mockUser = {
      id: `user_${Date.now()}`,
      userId: `user_${Date.now()}`, // Добавляем userId для совместимости
      telegramId,
      name
    };

    dbTracker.set('rows_affected', 1);
    dbTracker.set('operation_time_ms', Date.now() % 100);

    repositoryLogger.info('upsertUser', 'User successfully saved to database',
      { userId: mockUser.id },
      { executionTimeMs: dbTracker.end().duration }
    );

    return mockUser;

  } catch (error) {
    dbTracker.end();
    repositoryLogger.error('upsertUser', 'Database operation failed',
      error as Error,
      { telegramId, operation: 'UPSERT' },
      {}
    );
    throw error;
  }
}

// ============================================================================
// 5. DOMAIN LAYER (if needed for domain events)
// ============================================================================

const domainLogger = LoggerFactory.domainService('user-domain');

export function validateUserRegistration(telegramId: number | bigint, name: string) {
  domainLogger.debug('validateUserRegistration', 'Validating user registration data',
    { telegramId, nameLength: name?.length }
  );

  const validationResult = {
    isValid: true,
    errors: [] as string[]
  };

  if (!telegramId || telegramId <= 0) {
    validationResult.isValid = false;
    validationResult.errors.push('Invalid telegramId');
  }

  if (!name?.trim()) {
    validationResult.isValid = false;
    validationResult.errors.push('Name cannot be empty');
  }

  domainLogger.validation('validateUserRegistration', 'User data validation', 
    validationResult.isValid, 
    validationResult
  );

  return validationResult;
}

// ============================================================================
// 6. EXTERNAL SERVICE INTEGRATION
// ============================================================================

const externalLogger = LoggerFactory.external('telegram-api');

export async function sendTelegramMessage(chatId: number, text: string) {
  externalLogger.info('sendMessage', 'Sending message to Telegram',
    { chatId, textLength: text.length },
    { component: 'telegram-api', operation: 'sendMessage' }
  );

  const startTime = Date.now();
  
  try {
    // Simulate external API call
    await new Promise(resolve => setTimeout(resolve, 50));
    const duration = Date.now() - startTime;

    externalLogger.external('sendMessage', 'telegram-api', 'sendMessage', true, duration);

    return { success: true };

  } catch (error) {
    const duration = Date.now() - startTime;
    externalLogger.external('sendMessage', 'telegram-api', 'sendMessage', false, duration, error as Error);
    throw error;
  }
}

// ============================================================================
// COMPLETE OPERATION FLOW EXAMPLE
// ============================================================================

export async function completeUserRegistrationFlow(ctx: any) {
  // Start with correlation ID for the entire flow
  const flowCorrelationId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Use presentation logger for the main flow
  const flowLogger = LoggerFactory.bot('registration-flow').withCorrelationId(flowCorrelationId);

  flowLogger.info('completeUserRegistrationFlow', 'Starting complete user registration flow',
    { telegramId: ctx.from.id },
    { correlationId: flowCorrelationId }
  );

  try {
    // This would chain all the above operations
    const result = await handleUserStartCommand(ctx);
    
    flowLogger.info('completeUserRegistrationFlow', 'User registration flow completed successfully',
      {
        userId: result.userId,
        correlationId: result.correlationId
      },
      {
        correlationId: flowCorrelationId,
        executionTimeMs: Date.now() - parseInt(flowCorrelationId.split('_')[1] || '0')
      }
    );

    return result;

  } catch (error) {
    flowLogger.error('completeUserRegistrationFlow', 'User registration flow failed',
      error as Error,
      { 
        telegramId: ctx.from.id,
        error: (error as Error).message 
      },
      { correlationId: flowCorrelationId }
    );
    throw error;
  }
}

// ============================================================================
// ERROR HANDLING AND CORRELATION
// ============================================================================

const errorLogger = LoggerFactory.bot('error-handler');

export function logErrorWithContext(error: Error, context: any, correlationId?: string) {
  const logger = errorLogger.withCorrelationId(correlationId || 'no-correlation');
  
  logger.error('handleError', 'Error occurred in application flow',
    error,
    context,
    {}
  );
}

// ============================================================================
// MONITORING AND METRICS
// ============================================================================

const metricsLogger = LoggerFactory.external('monitoring');

export function logMetrics(operation: string, duration: number, success: boolean, metadata?: any) {
  metricsLogger.info('logMetrics', 'Operation metrics recorded',
    {
      operation,
      duration,
      success,
      ...metadata
    },
    {
      operation,
      executionTimeMs: duration
    }
  );
}