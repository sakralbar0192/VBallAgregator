import { GameRepo, RegistrationRepo } from '../../infrastructure/repositories/index.js';
import { BusinessRuleError } from '../errors/business-rule-error.js';
import { RegStatus } from '../registration.js';
import { v4 as uuid } from 'uuid';
import { Registration } from '../registration.js';

export class GameDomainService {
  constructor(
    private gameRepo: GameRepo,
    private registrationRepo: RegistrationRepo
  ) {}

  async validatePaymentMarking(gameId: string, userId: string) {
    const game = await this.gameRepo.findById(gameId);
    if (!game) throw new BusinessRuleError('NOT_FOUND', 'Игра не найдена');

    // Check if payment window is open
    if (!game.isPaymentWindowOpen) {
      throw new BusinessRuleError('PAYMENT_WINDOW_NOT_OPEN', 'Окно оплаты еще не открыто');
    }

    const registration = await this.registrationRepo.get(gameId, userId);
    if (!registration || registration.status !== RegStatus.confirmed) {
      throw new BusinessRuleError('NOT_CONFIRMED', 'Только подтвержденные участники могут отмечать оплату');
    }

    return { game, registration };
  }

  async processJoinGame(gameId: string, userId: string) {
    // Advisory lock уже в repo.transaction
    const game = await this.gameRepo.findById(gameId);
    if (!game) throw new BusinessRuleError('NOT_FOUND', 'Игра не найдена');

    // Проверяем статус игры
    if (game.status !== 'open') {
      throw new BusinessRuleError('GAME_NOT_OPEN', 'Игра не открыта для записи');
    }

    const confirmedCount = await this.gameRepo.countConfirmed(gameId);
    const existing = await this.registrationRepo.get(gameId, userId);

    if (existing && existing.status === RegStatus.confirmed) {
      throw new BusinessRuleError('ALREADY_REGISTERED', 'Вы уже зарегистрированы на эту игру');
    }

    if (existing && existing.status === RegStatus.waitlisted) {
      return { status: existing.status };
    }

    // Если canceled или не существует, создаем новую регистрацию
    const status = confirmedCount < game.capacity ? RegStatus.confirmed : RegStatus.waitlisted;

    if (status === RegStatus.confirmed) {
      game.ensureCanJoin(confirmedCount);
    }

    const registration = new Registration(uuid(), gameId, userId, status);
    await this.registrationRepo.upsert(registration);

    return { status };
  }
}