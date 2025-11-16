import { GameApplicationService } from './game-service.js';
import { UserApplicationService } from './user-service.js';
import {
  PrismaGameRepo,
  PrismaRegistrationRepo,
  PrismaUserRepo,
  PrismaOrganizerRepo
} from '../../infrastructure/repositories/index.js';
import { EventBus } from '../../shared/event-bus.js';
import { GameDomainService } from '../../domain/services/game-domain-service.js';
import { SchedulerService } from '../../shared/scheduler-service.js';

/**
 * Фабрика для создания и инициализации application services
 * Централизует управление зависимостями и инстанцированием сервисов
 */
export class ApplicationServiceFactory {
  private static instance: ApplicationServiceFactory;
  private gameApplicationService: GameApplicationService | null = null;
  private userApplicationService: UserApplicationService | null = null;

  private constructor() {}

  /**
   * Получает singleton инстанс фабрики
   */
  static getInstance(): ApplicationServiceFactory {
    if (!ApplicationServiceFactory.instance) {
      ApplicationServiceFactory.instance = new ApplicationServiceFactory();
    }
    return ApplicationServiceFactory.instance;
  }

  /**
   * Получает или создает GameApplicationService
   */
  getGameApplicationService(): GameApplicationService {
    if (!this.gameApplicationService) {
      const gameRepo = new PrismaGameRepo();
      const registrationRepo = new PrismaRegistrationRepo();
      const organizerRepo = new PrismaOrganizerRepo();
      const eventBus = EventBus.getInstance();
      const gameDomainService = new GameDomainService(gameRepo, registrationRepo);
      const schedulerService = new SchedulerService(eventBus);

      this.gameApplicationService = new GameApplicationService(
        gameRepo,
        registrationRepo,
        organizerRepo,
        eventBus,
        gameDomainService,
        schedulerService
      );
    }
    return this.gameApplicationService;
  }

  /**
   * Получает или создает UserApplicationService
   */
  getUserApplicationService(): UserApplicationService {
    if (!this.userApplicationService) {
      const userRepo = new PrismaUserRepo();
      this.userApplicationService = new UserApplicationService(userRepo);
    }
    return this.userApplicationService;
  }

  /**
   * Получает GameRepo через GameApplicationService
   */
  getGameRepo() {
    return new PrismaGameRepo();
  }

  /**
   * Получает RegistrationRepo через GameApplicationService
   */
  getRegistrationRepo() {
    return new PrismaRegistrationRepo();
  }

  /**
   * Получает UserRepo через UserApplicationService
   */
  getUserRepo() {
    return new PrismaUserRepo();
  }

  /**
   * Получает OrganizerRepo
   */
  getOrganizerRepo() {
    return new PrismaOrganizerRepo();
  }

  /**
   * Получает EventBus
   */
  getEventBus(): EventBus {
    return EventBus.getInstance();
  }

  /**
   * Получает SchedulerService
   */
  getSchedulerService(): SchedulerService {
    return new SchedulerService(this.getEventBus());
  }

  /**
   * Сбрасывает кэш сервисов (для тестирования)
   */
  reset(): void {
    this.gameApplicationService = null;
    this.userApplicationService = null;
  }
}
