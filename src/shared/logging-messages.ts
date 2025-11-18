/**
 * Константы для сообщений логирования
 * Организованы по архитектурным слоям и компонентам для обеспечения консистентности
 */

export const LOG_MESSAGES = {
  // Presentation Layer - Bot handlers
  BOT: {
    START_COMMAND_INITIATED: 'Пользователь инициировал команду /start',
    START_COMMAND_FAILED: 'Не удалось обработать команду пользователя /start',
    REGISTER_USER_ENTRY: 'registerUser',
    REGISTER_USER_EXIT: 'registerUser',
  },

  // Application Layer - Use Cases
  USE_CASES: {
    JOIN_GAME_PROCESSING: 'Обработка запроса на присоединение к игре',
    JOIN_GAME_COMPLETED: 'Присоединение к игре завершено успешно',
    REGISTER_USER_PROCESSING: 'Обработка запроса на регистрацию пользователя',
    REGISTER_USER_COMPLETED: 'Регистрация пользователя завершена успешно',
    REGISTER_USER_FAILED: 'Регистрация пользователя не удалась',
    REGISTER_ORGANIZER_PROCESSING: 'Обработка запроса на регистрацию организатора',
    REGISTER_ORGANIZER_COMPLETED: 'Регистрация организатора завершена успешно',
    REGISTER_ORGANIZER_FAILED: 'Регистрация организатора не удалась',
  },

  // Application Layer - Startup/Shutdown
  STARTUP: {
    CONFIG_VALIDATED: 'Конфигурация валидирована',
    EVENT_HANDLERS_REGISTERED: 'Обработчики событий зарегистрированы',
    QUEUE_WORKERS_INITIALIZED: 'Workers очереди инициализированы',
    HEALTH_CHECK_PASSED: 'Проверка здоровья системы пройдена',
    BOT_STARTED_SUCCESSFULLY: 'Бот успешно запущен',
    GRACEFUL_SHUTDOWN_INITIATED: 'Graceful shutdown инициирован',
    BOT_STOPPED: 'Бот остановлен',
    SCHEDULER_CLOSED: 'Scheduler закрыт',
    REDIS_DISCONNECTED: 'Redis отключен',
    DATABASE_DISCONNECTED: 'База данных отключена',
    GRACEFUL_SHUTDOWN_COMPLETED: 'Graceful shutdown завершен',
    FAILED_TO_START_APPLICATION: 'Не удалось запустить приложение',
    ERROR_DURING_GRACEFUL_SHUTDOWN: 'Ошибка во время graceful shutdown',
    UNHANDLED_ERROR_DURING_STARTUP: 'Необработанная ошибка при запуске',
  },

  // Application Services
  SERVICES: {
    USER_SERVICE_INVOKE_REPO: 'Вызов операции репозитория пользователей',
    USER_SERVICE_REGISTER_COMPLETED: 'Регистрация пользователя завершена успешно',
    GAME_SERVICE_CREATE_START: 'Начало процесса создания игры',
    GAME_SERVICE_ORGANIZER_NOT_FOUND: 'Организатор не найден',
    GAME_SERVICE_VENUE_CONFLICT: 'Обнаружен конфликт площадок',
    GAME_SERVICE_CREATE_COMPLETED: 'Игра создана успешно',
    GAME_SERVICE_FINISH_COMPLETED: 'Игра завершена и напоминания об оплате запланированы',
    GAME_SERVICE_ORGANIZER_REGISTERED: 'Организатор зарегистрирован',
  },

  // Infrastructure Services
  INFRASTRUCTURE_SERVICES: {
    API_SERVER_SIGNAL_RECEIVED: 'Получен сигнал {{signal}}, закрытие сервера',
    API_SERVER_LISTENING: 'API сервер слушает на {{address}}',
    API_SERVER_FAILED_TO_START: 'Не удалось запустить API сервер',
    NOTIFICATION_SERVICE_SENT: 'Уведомление отправлено',
    NOTIFICATION_SERVICE_PERMANENT_ERROR: 'Постоянная ошибка уведомления',
    NOTIFICATION_SERVICE_TEMPORARY_ERROR: 'Временная ошибка уведомления',
    ENHANCED_NOTIFICATION_SERVICE_SENT: 'Сообщение отправлено',
    ENHANCED_NOTIFICATION_SERVICE_PERMANENT_ERROR: 'Постоянная ошибка уведомления',
    ENHANCED_NOTIFICATION_SERVICE_TEMPORARY_ERROR: 'Временная ошибка уведомления',
    ENHANCED_NOTIFICATION_SERVICE_BLOCKED_BY_PREFERENCES: 'Уведомление заблокировано предпочтениями пользователя',
    ENHANCED_NOTIFICATION_SERVICE_BLOCKED_BY_IDEMPOTENCY: 'Уведомление заблокировано проверкой идемпотентности',
    ENHANCED_NOTIFICATION_SERVICE_BLOCKED_BY_RATE_LIMIT: 'Уведомление заблокировано ограничением скорости',
    ENHANCED_NOTIFICATION_SERVICE_SENT_SUCCESSFULLY: 'Уведомление отправлено успешно',
    EVENT_BUS_PUBLISHING: 'Публикация события через EventBus',
    EVENT_BUS_PROCESSING_FAILURES: 'Ошибки обработки события',
    EVENT_BUS_HANDLER_FAILED: 'Обработчик события не удался',
    RATE_LIMITER_REDIS_ERROR: 'Ошибка подключения Redis',
    RATE_LIMITER_REDIS_CONNECTED: 'Подключено к Redis для ограничения скорости',
    RATE_LIMITER_CHECK_FAILED: 'Проверка ограничения скорости не удалась, разрешение запроса',
    RATE_LIMITER_CONSUME_FAILED: 'Потребление ограничения скорости не удалось, игнорирование',
    IDEMPOTENCY_SERVICE_REDIS_ERROR: 'Ошибка подключения Redis в сервисе идемпотентности',
    IDEMPOTENCY_SERVICE_REDIS_CONNECTED: 'Подключено к Redis для идемпотентности',
    USER_PREFERENCES_SERVICE_GET_FAILED: 'Не удалось получить предпочтения пользователя',
    USER_PREFERENCES_SERVICE_UPDATE_COMPLETED: 'Предпочтения пользователя обновлены',
    USER_PREFERENCES_SERVICE_UPDATE_FAILED: 'Не удалось обновить предпочтения пользователя',
    USER_PREFERENCES_SERVICE_UNKNOWN_TYPE: 'Неизвестный тип уведомления для проверки предпочтений',
    USER_PREFERENCES_SERVICE_CHECK_FAILED: 'Проверка предпочтений не удалась, разрешение уведомления',
  },

  // Infrastructure Services - Scheduler
  SCHEDULER: {
    GAME_REMINDER_24H_SCHEDULED: 'Напоминание за 24 часа запланировано',
    GAME_REMINDER_2H_SCHEDULED: 'Напоминание за 2 часа запланировано',
    PAYMENT_REMINDER_12H_SCHEDULED: 'Напоминание об оплате за 12 часов запланировано',
    PAYMENT_REMINDER_24H_SCHEDULED: 'Напоминание об оплате за 24 часа запланировано',
    REMINDER_JOB_PROCESSING: 'Обработка задачи напоминания',
    PAYMENT_REMINDER_JOB_PROCESSING: 'Обработка задачи напоминания об оплате',
    UNKNOWN_REMINDER_JOB_TYPE: 'Неизвестный тип задачи напоминания',
    UNKNOWN_PAYMENT_REMINDER_JOB_TYPE: 'Неизвестный тип задачи напоминания об оплате',
    REMINDER_JOB_FAILED: 'Задача напоминания не удалась',
    PAYMENT_REMINDER_JOB_FAILED: 'Задача напоминания об оплате не удалась',
    WORKERS_INITIALIZED: 'Воркеры планировщика инициализированы',
    QUEUES_CLOSED: 'Очереди закрыты',
  },

  // Infrastructure Layer - Repositories
  REPOSITORIES: {
    USER_UPSERT_COMPLETED: 'Операция upsert пользователя завершена успешно',
  },

  // Cross-cutting - Event Handlers
  EVENT_HANDLERS: {
    SETUP_COMPLETED: 'Настройка обработчиков событий завершена',
    GAME_REMINDER_24H_PROCESSING: 'Обработка напоминания об игре за 24 часа',
    GAME_REMINDER_24H_NOT_FOUND: 'Игра не найдена для напоминания за 24 часа',
    GAME_REMINDER_24H_SENT: 'Напоминания об игре за 24 часа отправлены',
    GAME_REMINDER_24H_FAILED: 'Не удалось отправить напоминания об игре за 24 часа',
    GAME_REMINDER_2H_PROCESSING: 'Обработка напоминания об игре за 2 часа',
    GAME_REMINDER_2H_NOT_FOUND: 'Игра не найдена для напоминания за 2 часа',
    GAME_REMINDER_2H_SENT: 'Напоминания об игре за 2 часа отправлены',
    GAME_REMINDER_2H_FAILED: 'Не удалось отправить напоминания об игре за 2 часа',
    PAYMENT_REMINDER_12H_PROCESSING: 'Обработка напоминания об оплате за 12 часов',
    PAYMENT_REMINDER_12H_NOT_FOUND: 'Игра не найдена для напоминания об оплате за 12 часов',
    PAYMENT_REMINDER_12H_WINDOW_NOT_OPEN: 'Окно оплаты еще не открыто, напоминание пропущено',
    PAYMENT_REMINDER_12H_SENT: 'Напоминания об оплате за 12 часов отправлены',
    PAYMENT_REMINDER_12H_FAILED: 'Не удалось отправить напоминания об оплате за 12 часов',
    PAYMENT_REMINDER_24H_PROCESSING: 'Обработка напоминания об оплате за 24 часа',
    PAYMENT_REMINDER_24H_NOT_FOUND: 'Игра не найдена для напоминания об оплате за 24 часа',
    PAYMENT_REMINDER_24H_WINDOW_NOT_OPEN: 'Окно оплаты еще не открыто, напоминание пропущено',
    PAYMENT_REMINDER_24H_SENT: 'Напоминания об оплате за 24 часа отправлены',
    PAYMENT_REMINDER_24H_FAILED: 'Не удалось отправить напоминания об оплате за 24 часа',
    PLAYER_JOINED_PROCESSING: 'Обработка события присоединения игрока',
    PLAYER_JOINED_ORGANIZER_NOT_FOUND: 'Организатор не найден для уведомления о присоединении игрока',
    PLAYER_JOINED_PLAYER_NOT_FOUND: 'Игрок не найден для уведомления о присоединении',
    PLAYER_JOINED_NOTIFICATION_SENT: 'Уведомление о присоединении игрока отправлено организатору',
    PLAYER_JOINED_NOTIFICATION_FAILED: 'Не удалось отправить уведомление о присоединении игрока',
    WAITLIST_PROMOTED_PROCESSING: 'Обработка продвижения из списка ожидания',
    WAITLIST_PROMOTED_USER_NOT_FOUND: 'Пользователь не найден для уведомления о продвижении из списка ожидания',
    WAITLIST_PROMOTED_NOTIFICATION_SENT: 'Уведомление о продвижении из списка ожидания отправлено',
    WAITLIST_PROMOTED_NOTIFICATION_FAILED: 'Не удалось отправить уведомление о продвижении из списка ожидания',
    PAYMENT_MARKED_PROCESSING: 'Обработка отметки оплаты',
    PAYMENT_MARKED_ORGANIZER_NOT_FOUND: 'Организатор не найден для уведомления об отметке оплаты',
    PAYMENT_MARKED_USER_NOT_FOUND: 'Пользователь не найден для уведомления об отметке оплаты',
    PAYMENT_MARKED_NOTIFICATION_SENT: 'Уведомление об отметке оплаты отправлено организатору',
    PAYMENT_MARKED_NOTIFICATION_FAILED: 'Не удалось отправить уведомление об отметке оплаты',
    SEND_PAYMENT_REMINDERS_PROCESSING: 'Обработка отправки напоминаний об оплате',
    SEND_PAYMENT_REMINDERS_GAME_NOT_FOUND: 'Игра не найдена для отправки напоминаний об оплате',
    SEND_PAYMENT_REMINDERS_SENT: 'Ручные напоминания об оплате отправлены',
    SEND_PAYMENT_REMINDERS_FAILED: 'Не удалось отправить ручные напоминания об оплате',
    REGISTRATION_CANCELED_PROCESSING: 'Обработка отмены регистрации',
    REGISTRATION_CANCELED_ORGANIZER_NOT_FOUND: 'Организатор не найден для уведомления об отмене регистрации',
    REGISTRATION_CANCELED_PLAYER_NOT_FOUND: 'Игрок не найден для уведомления об отмене регистрации',
    REGISTRATION_CANCELED_NOTIFICATION_SENT: 'Уведомление об отмене регистрации отправлено организатору',
    REGISTRATION_CANCELED_NOTIFICATION_FAILED: 'Не удалось отправить уведомление об отмене регистрации',
    GAME_CLOSED_PROCESSING: 'Обработка закрытия игры',
    PLAYER_LINKED_TO_ORGANIZER_PROCESSING: 'Обработка связи игрока с организатором',
    PAYMENT_ATTEMPT_REJECTED_EARLY_PROCESSING: 'Обработка ранней попытки оплаты',
    PLAYER_SELECTED_ORGANIZERS_PROCESSING: 'Обработка выбора организаторов игроком',
    PLAYER_SELECTED_ORGANIZERS_PLAYER_NOT_FOUND: 'Игрок не найден для уведомления организаторов',
    PLAYER_SELECTED_ORGANIZERS_NOTIFICATIONS_SENT: 'Уведомления о выборе организаторов отправлены',
    PLAYER_SELECTED_ORGANIZERS_NOTIFICATIONS_FAILED: 'Не удалось отправить уведомления о выборе организаторов',
    PLAYER_CONFIRMED_BY_ORGANIZER_PROCESSING: 'Обработка подтверждения игрока организатором',
    PLAYER_CONFIRMED_BY_ORGANIZER_PLAYER_NOT_FOUND: 'Игрок не найден для уведомления о подтверждении',
    PLAYER_CONFIRMED_BY_ORGANIZER_NOTIFICATION_SENT: 'Уведомление о подтверждении игрока отправлено',
    PLAYER_CONFIRMED_BY_ORGANIZER_NOTIFICATION_FAILED: 'Не удалось отправить уведомление о подтверждении игрока',
    PLAYER_REJECTED_BY_ORGANIZER_PROCESSING: 'Обработка отклонения игрока организатором',
    PLAYER_REJECTED_BY_ORGANIZER_PLAYER_NOT_FOUND: 'Игрок не найден для уведомления об отклонении',
    PLAYER_REJECTED_BY_ORGANIZER_NOTIFICATION_SENT: 'Уведомление об отклонении игрока отправлено',
    PLAYER_REJECTED_BY_ORGANIZER_NOTIFICATION_FAILED: 'Не удалось отправить уведомление об отклонении игрока',
    GAME_CREATED_WITH_PRIORITY_WINDOW_PROCESSING: 'Обработка создания игры с приоритетным окном',
    GAME_CREATED_WITH_PRIORITY_WINDOW_GAME_NOT_FOUND: 'Игра не найдена для отправки приоритетных приглашений',
    GAME_CREATED_WITH_PRIORITY_WINDOW_INVITATIONS_SENT: 'Приоритетные приглашения на игру отправлены',
    GAME_CREATED_WITH_PRIORITY_WINDOW_INVITATIONS_FAILED: 'Не удалось отправить приоритетные приглашения на игру',
    PLAYER_RESPONDED_TO_GAME_INVITATION_PROCESSING: 'Обработка ответа игрока на приглашение',
    PLAYER_RESPONDED_TO_GAME_INVITATION_ORGANIZER_NOT_FOUND: 'Организатор не найден для уведомления об ответе',
    PLAYER_RESPONDED_TO_GAME_INVITATION_AUTO_JOINED: 'Игрок автоматически присоединился к игре после положительного ответа',
    PLAYER_RESPONDED_TO_GAME_INVITATION_AUTO_JOIN_FAILED: 'Не удалось автоматически добавить игрока к игре после положительного ответа',
    PLAYER_RESPONDED_TO_GAME_INVITATION_RESPONSE_SENT: 'Уведомление об ответе игрока отправлено организатору',
    PLAYER_RESPONDED_TO_GAME_INVITATION_RESPONSE_FAILED: 'Не удалось отправить уведомление об ответе игрока',
    GAME_PUBLISHED_FOR_ALL_PROCESSING: 'Обработка публикации игры для всех',
    GAME_PUBLISHED_FOR_ALL_GAME_NOT_FOUND: 'Игра не найдена для отправки уведомлений о публикации',
    GAME_PUBLISHED_FOR_ALL_NOTIFICATIONS_SENT: 'Уведомления о публикации игры для всех отправлены',
    GAME_PUBLISHED_FOR_ALL_NOTIFICATIONS_FAILED: 'Не удалось отправить уведомления о публикации игры для всех',
  },
} as const;

/**
 * Типы для ключей сообщений логирования
 * Обеспечивают типобезопасность при использовании констант
 */
export type LogMessageKey = keyof typeof LOG_MESSAGES;
export type BotLogKey = keyof typeof LOG_MESSAGES.BOT;
export type StartupLogKey = keyof typeof LOG_MESSAGES.STARTUP;
export type UseCaseLogKey = keyof typeof LOG_MESSAGES.USE_CASES;
export type ServiceLogKey = keyof typeof LOG_MESSAGES.SERVICES;
export type RepositoryLogKey = keyof typeof LOG_MESSAGES.REPOSITORIES;
export type EventHandlerLogKey = keyof typeof LOG_MESSAGES.EVENT_HANDLERS;