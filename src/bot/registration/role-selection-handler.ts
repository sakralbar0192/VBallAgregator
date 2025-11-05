import { Context } from 'telegraf';
import { BaseHandler } from '../common/base-handler.js';
import { LoggerFactory } from '../../shared/layer-logger.js';

/**
 * Обработчик выбора роли пользователя
 * (Пока что пустой, логика распределена по другим обработчикам)
 */
export class RoleSelectionHandler extends BaseHandler {
  protected static override logger = LoggerFactory.bot('role-selection-handler');

  // Этот класс может быть расширен в будущем для дополнительной логики выбора роли
}