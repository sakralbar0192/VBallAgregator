import { LoggerFactory } from '../../shared/layer-logger.js';
import { BusinessRuleError } from '../../domain/errors/business-rule-error.js';
import { InputValidator } from '../../shared/input-validator.js';
import { EventBus } from '../../shared/event-bus.js';
import { prisma } from '../../infrastructure/prisma.js';

/**
 * Application Service для управления приглашениями на игры
 */
export class InvitationApplicationService {
  private logger = LoggerFactory.service('InvitationApplicationService');

  constructor(
    private eventBus: EventBus
  ) {}

  /**
   * Позволяет игроку ответить на приглашение к игре
   */
  async respondToGameInvitation(gameId: string, playerId: string, response: string): Promise<{ ok: boolean }> {
    InputValidator.validateRequired(gameId, 'gameId');
    InputValidator.validateRequired(playerId, 'playerId');
    InputValidator.validateEnum(response, 'response', ['yes', 'no', 'ignored']);

    // Проверить, что игрок — подтвержденный игрок организатора игры
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { organizerId: true, createdAt: true }
    });
    if (!game) {
      throw new BusinessRuleError('NOT_FOUND', 'Игра не найдена');
    }

    const isConfirmedPlayer = await (prisma as any).playerOrganizer.findFirst({
      where: {
        playerId,
        organizerId: game.organizerId,
        status: 'confirmed'
      }
    });

    if (!isConfirmedPlayer) {
      throw new BusinessRuleError('FORBIDDEN', 'Только подтвержденные игроки организатора могут отвечать на приглашения');
    }

    // Обновить или создать запись GamePlayerResponse
    await (prisma as any).gamePlayerResponse.upsert({
      where: {
        gameId_playerId: { gameId, playerId }
      },
      update: {
        response: response as any,
        respondedAt: response !== 'ignored' ? new Date() : null
      },
      create: {
        gameId,
        playerId,
        response: response as any,
        respondedAt: response !== 'ignored' ? new Date() : null
      }
    });

    await this.eventBus.publish({
      type: 'PlayerRespondedToGameInvitation',
      occurredAt: new Date(),
      id: '',
      payload: { gameId, playerId, response }
    });

    // Проверить, все ли приоритетные игроки ответили
    await this.checkIfAllPriorityPlayersResponded(gameId);

    return { ok: true };
  }

  /**
   * Уведомляет подтвержденных игроков о новой игре
   */
  async notifyConfirmedPlayersAboutGame(gameId: string): Promise<void> {
    InputValidator.validateRequired(gameId, 'gameId');

    // Найти игру и организатора
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { organizer: true }
    });
    if (!game) {
      throw new BusinessRuleError('NOT_FOUND', 'Игра не найдена');
    }

    // Найти всех подтвержденных игроков организатора
    const confirmedPlayers = await (prisma as any).playerOrganizer.findMany({
      where: {
        organizerId: game.organizer.id,
        status: 'confirmed'
      },
      include: {
        player: true
      }
    });

    // Создать записи GamePlayerResponse со статусом 'ignored' (ожидание ответа)
    const responses = confirmedPlayers.map((po: any) => ({
      gameId,
      playerId: po.player.id,
      response: 'ignored' as const
    }));

    await (prisma as any).gamePlayerResponse.createMany({
      data: responses,
      skipDuplicates: true
    });

    // Опубликовать событие для уведомления игроков
    const priorityWindowClosesAt = new Date(game.createdAt.getTime() + 2 * 60 * 60 * 1000);
    await this.eventBus.publish({
      type: 'GameCreatedWithPriorityWindow',
      occurredAt: new Date(),
      id: '',
      payload: {
        gameId,
        priorityWindowClosesAt: priorityWindowClosesAt.toISOString(),
        confirmedPlayers: confirmedPlayers.map((po: any) => ({
          playerId: po.player.id,
          telegramId: po.player.telegramId
        }))
      }
    });
  }

  /**
   * Проверяет, все ли приоритетные игроки ответили на приглашение
   */
  private async checkIfAllPriorityPlayersResponded(gameId: string): Promise<void> {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { organizerId: true }
    });

    if (!game) {
      return;
    }

    // Получить всех подтвержденных игроков организатора
    const confirmedPlayers = await (prisma as any).playerOrganizer.findMany({
      where: {
        organizerId: game.organizerId,
        status: 'confirmed'
      },
      select: { playerId: true }
    });

    if (confirmedPlayers.length === 0) {
      // Нет приоритетных игроков — сразу открываем для всех
      await this.eventBus.publish({
        type: 'GamePublishedForAll',
        occurredAt: new Date(),
        id: '',
        payload: { gameId }
      });
      return;
    }

    // Получить ответы всех приоритетных игроков
    const responses = await (prisma as any).gamePlayerResponse.findMany({
      where: {
        gameId,
        playerId: { in: confirmedPlayers.map((p: any) => p.playerId) }
      },
      select: { response: true }
    });

    // Проверить, все ли ответили (не 'ignored')
    const allResponded = responses.length === confirmedPlayers.length &&
      responses.every((r: any) => r.response !== 'ignored');

    if (allResponded) {
      await this.eventBus.publish({
        type: 'GamePublishedForAll',
        occurredAt: new Date(),
        id: '',
        payload: { gameId }
      });
    }
  }

  /**
   * Проверяет истечение приоритетного окна и публикует игру для всех
   */
  async checkPriorityWindowExpiration(gameId: string): Promise<void> {
    InputValidator.validateRequired(gameId, 'gameId');

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: { status: true, createdAt: true }
    });

    if (!game || game.status !== 'open') {
      return;
    }

    // Проверить, истекло ли приоритетное окно (2 часа после создания)
    const priorityWindowClosesAt = new Date(game.createdAt.getTime() + 2 * 60 * 60 * 1000);
    if (priorityWindowClosesAt > new Date()) {
      return;
    }

    // Приоритетное окно истекло — публикуем игру для всех
    await this.eventBus.publish({
      type: 'GamePublishedForAll',
      occurredAt: new Date(),
      id: '',
      payload: { gameId }
    });
  }
}
