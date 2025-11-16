import { LoggerFactory } from '../../shared/layer-logger.js';
import { BusinessRuleError } from '../../domain/errors/business-rule-error.js';
import { InputValidator } from '../../shared/input-validator.js';
import { EventBus } from '../../shared/event-bus.js';
import { prisma } from '../../infrastructure/prisma.js';

/**
 * Application Service для управления организаторами и их игроками
 */
export class OrganizerApplicationService {
  private logger = LoggerFactory.service('OrganizerApplicationService');

  constructor(
    private eventBus: EventBus
  ) {}

  /**
   * Позволяет игроку выбрать организаторов
   */
  async selectOrganizers(playerId: string, organizerIds: string[]): Promise<{ ok: boolean }> {
    InputValidator.validateRequired(playerId, 'playerId');

    // Проверить существование игрока
    const player = await prisma.user.findUnique({ where: { id: playerId } });
    if (!player) throw new BusinessRuleError('NOT_FOUND', 'Игрок не найден');

    // Если массив пустой, удалить все существующие связи
    if (!organizerIds?.length) {
      await (prisma as any).playerOrganizer.deleteMany({
        where: { playerId }
      });
      return { ok: true };
    }

    // Проверить существование организаторов
    const organizers = await (prisma as any).organizer.findMany({
      where: { id: { in: organizerIds } }
    });
    if (organizers.length !== organizerIds.length) {
      throw new BusinessRuleError('NOT_FOUND', 'Один или несколько организаторов не найдены');
    }

    // Удалить существующие связи и создать новые со статусом pending
    await prisma.$transaction(async (tx: any) => {
      await tx.playerOrganizer.deleteMany({
        where: { playerId }
      });

      const playerOrganizers = organizerIds.map(organizerId => ({
        playerId,
        organizerId,
        status: 'pending' as const,
      }));

      await tx.playerOrganizer.createMany({
        data: playerOrganizers
      });
    });

    await this.eventBus.publish({
      type: 'PlayerSelectedOrganizers',
      occurredAt: new Date(),
      id: '',
      payload: { playerId, organizerIds }
    });

    return { ok: true };
  }

  /**
   * Позволяет организатору подтвердить игрока
   */
  async confirmPlayer(organizerId: string, playerId: string): Promise<{ ok: boolean }> {
    InputValidator.validateRequired(organizerId, 'organizerId');
    InputValidator.validateRequired(playerId, 'playerId');

    // Проверить существование связи со статусом pending
    const playerOrganizer = await (prisma as any).playerOrganizer.findUnique({
      where: { playerId_organizerId: { playerId, organizerId } }
    });
    if (!playerOrganizer) {
      throw new BusinessRuleError('NOT_FOUND', 'Связь между игроком и организатором не найдена');
    }
    if (playerOrganizer.status !== 'pending') {
      throw new BusinessRuleError('INVALID_STATE', 'Игрок уже подтвержден или отклонен');
    }

    // Обновить статус на confirmed
    await (prisma as any).playerOrganizer.update({
      where: { playerId_organizerId: { playerId, organizerId } },
      data: { status: 'confirmed', confirmedAt: new Date() }
    });

    // Получить имя игрока для события
    const player = await prisma.user.findUnique({ where: { id: playerId } });

    await this.eventBus.publish({
      type: 'PlayerConfirmedByOrganizer',
      occurredAt: new Date(),
      id: '',
      payload: { organizerId, playerId, playerName: player?.name || 'Unknown' }
    });

    return { ok: true };
  }

  /**
   * Позволяет организатору отклонить игрока
   */
  async rejectPlayer(organizerId: string, playerId: string): Promise<{ ok: boolean }> {
    InputValidator.validateRequired(organizerId, 'organizerId');
    InputValidator.validateRequired(playerId, 'playerId');

    // Обновить статус на rejected
    const result = await (prisma as any).playerOrganizer.updateMany({
      where: {
        playerId,
        organizerId,
        status: 'pending'
      },
      data: { status: 'rejected' }
    });

    if (result.count === 0) {
      throw new BusinessRuleError('NOT_FOUND', 'Связь между игроком и организатором не найдена или уже обработана');
    }

    // Получить имя игрока для события
    const player = await prisma.user.findUnique({ where: { id: playerId } });

    await this.eventBus.publish({
      type: 'PlayerRejectedByOrganizer',
      occurredAt: new Date(),
      id: '',
      payload: { organizerId, playerId, playerName: player?.name || 'Unknown' }
    });

    return { ok: true };
  }

  /**
   * Получает список игроков организатора
   */
  async getOrganizerPlayers(organizerId: string, status?: string): Promise<Array<any>> {
    InputValidator.validateRequired(organizerId, 'organizerId');

    const where: any = { organizerId };
    if (status) {
      where.status = status;
    }

    const playerOrganizers = await (prisma as any).playerOrganizer.findMany({
      where,
      include: {
        player: {
          select: { id: true, name: true, levelTag: true }
        }
      },
      orderBy: { requestedAt: 'desc' }
    });

    return playerOrganizers.map((po: any) => ({
      playerId: po.player.id,
      playerName: po.player.name,
      levelTag: po.player.levelTag,
      status: po.status,
      requestedAt: po.requestedAt,
      confirmedAt: po.confirmedAt
    }));
  }

  /**
   * Привязывает игрока к организатору
   */
  async linkPlayerToOrganizer(playerId: string, organizerId: string): Promise<{ ok: boolean }> {
    InputValidator.validateRequired(playerId, 'playerId');
    InputValidator.validateRequired(organizerId, 'organizerId');

    // Проверить существование игрока и организатора
    const player = await prisma.user.findUnique({ where: { id: playerId } });
    if (!player) throw new BusinessRuleError('NOT_FOUND', 'Игрок не найден');

    const organizer = await (prisma as any).organizer.findUnique({ where: { id: organizerId } });
    if (!organizer) throw new BusinessRuleError('NOT_FOUND', 'Организатор не найден');

    await this.eventBus.publish({
      type: 'PlayerLinkedToOrganizer',
      occurredAt: new Date(),
      id: '',
      payload: {
        playerId,
        organizerId,
        playerName: player.name
      }
    });

    return { ok: true };
  }
}
