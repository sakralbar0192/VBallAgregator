import { createBot } from './create-bot.js';

/** Экземпляр для продакшена: создаётся при первом импорте модуля */
const bot = await createBot();

export default bot;
export { createBot } from './create-bot.js';
