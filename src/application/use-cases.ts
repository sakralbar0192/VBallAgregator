  import { v4 as uuid } from 'uuid';
  import { Game, GameStatus } from '../domain/game.js';
  import { Registration, RegStatus } from '../domain/registration.js';
  import type { GameRepo, RegistrationRepo } from '../infrastructure/repositories.js';
  import { PrismaGameRepo, PrismaRegistrationRepo } from '../infrastructure/repositories.js';
  import { eventPublisher, evt } from '../shared/event-publisher.js';
  import { DomainError } from '../domain/errors.js';

  const gameRepo: GameRepo = new PrismaGameRepo();
  const registrationRepo: RegistrationRepo = new PrismaRegistrationRepo();

  /**
   * Позволяет пользователю присоединиться к игре.
   * @param {string} gameId - Идентификатор игры.
   * @param {string} userId - Идентификатор пользователя.
   * @returns {Promise<{ status: RegStatus }>} - Статус регистрации пользователя.
   * @throws {DomainError} - Если игра не найдена или пользователь не может присоединиться.
   */
  export async function joinGame(gameId: string, userId: string) {
    const game = await gameRepo.findById(gameId);
    if (!game) throw new DomainError('NOT_FOUND', 'Игра не найдена');

    const confirmedCount = await gameRepo.countConfirmed(gameId);
    const existing = await registrationRepo.get(gameId, userId);

    // Если уже зарегистрирован, вернуть текущий статус
    if (existing) {
      return { status: existing.status };
    }

    // Определить статус на основе текущего количества подтвержденных
    const status = confirmedCount < game.capacity ? RegStatus.confirmed : RegStatus.waitlisted;

    // Проверить правила игры - только если пытается присоединиться как подтвержденный
    if (status === RegStatus.confirmed) {
      game.ensureCanJoin(confirmedCount);
    }

    // Создать новую регистрацию
    const reg = new Registration(uuid(), gameId, userId, status);
    await registrationRepo.upsert(reg);

    await eventPublisher.publish(evt('PlayerJoined', { gameId, userId, status }));

    return { status };
  }

  /**
   * Позволяет пользователю покинуть игру.
   * @param {string} gameId - Идентификатор игры.
   * @param {string} userId - Идентификатор пользователя.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   */
  export async function leaveGame(gameId: string, userId: string) {
    const reg = await registrationRepo.get(gameId, userId);
    if (!reg) return { ok: true };
    if (reg.status === RegStatus.canceled) return { ok: true };

    reg.cancel();
    await registrationRepo.upsert(reg);
    await eventPublisher.publish(evt('RegistrationCanceled', { gameId, userId }));

    // Продвинуть следующего из списка ожидания
    const next = await registrationRepo.firstWaitlisted(gameId);
    if (next) {
      await registrationRepo.promoteToConfirmed(next.id);
      await eventPublisher.publish(evt('WaitlistedPromoted', { gameId, userId: next.userId }));
    }

    return { ok: true };
  }

  /**
   * Отмечает оплату для подтвержденного участника.
   * @param {string} gameId - Идентификатор игры.
   * @param {string} userId - Идентификатор пользователя.
   * @returns {Promise<{ ok: boolean }>} - Успех операции.
   * @throws {DomainError} - Если игра не найдена или окно оплаты еще не открыто.
   */
  export async function markPayment(gameId: string, userId: string) {
    const game = await gameRepo.findById(gameId);
    if (!game) throw new DomainError('NOT_FOUND', 'Игра не найдена');

    if (!(new Date() >= game.startsAt) || ![GameStatus.open, GameStatus.finished].includes(game.status)) {
      await eventPublisher.publish(evt('PaymentAttemptRejectedEarly', { gameId, userId }));
      throw new DomainError('PAYMENT_WINDOW_NOT_OPEN', 'Окно оплаты еще не открыто');
    }

    const reg = await registrationRepo.get(gameId, userId);
    if (!reg || reg.status !== RegStatus.confirmed) throw new DomainError('NOT_CONFIRMED', 'Только подтвержденные участники могут отмечать оплату');

    reg.markPaid(game);
    await registrationRepo.upsert(reg);
    await eventPublisher.publish(evt('PaymentMarked', { gameId, userId }));

    return { ok: true };
  }

  /**
   * Создает новую игру с заданными параметрами.
   * @param {Object} data - Данные для создания игры.
   * @param {string} data.organizerId - Идентификатор организатора.
   * @param {string} data.venueId - Идентификатор места проведения.
   * @param {Date} data.startsAt - Дата начала игры.
   * @param {number} data.capacity - Вместимость игры.
   * @param {string} [data.levelTag] - Уровень игры (опционально).
   * @param {string} [data.priceText] - Цена игры (опционально).
   * @returns {Promise<Game>} - Созданная игра.
   */
  export async function createGame(data: {
    organizerId: string;
    venueId: string;
    startsAt: Date;
    capacity: number;
    levelTag?: string;
    priceText?: string;
  }) {
    const g = new Game(uuid(), data.organizerId, data.venueId, data.startsAt, data.capacity, data.levelTag, data.priceText);
    await gameRepo.insertGame(g);
    await eventPublisher.publish(evt('GameCreated', {
      gameId: g.id,
      startsAt: g.startsAt.toISOString(),
      capacity: g.capacity,
      levelTag: g.levelTag,
      priceText: g.priceText
    }));
    return g;
  }

  /**
   * Закрывает игру.
   * @param {string} gameId - Идентификатор игры.
   * @returns {Promise<void>} - Успех операции.
   */
  export async function closeGame(gameId: string) {
    await gameRepo.updateStatus(gameId, GameStatus.closed);
    await eventPublisher.publish(evt('GameClosed', { gameId }));
  }