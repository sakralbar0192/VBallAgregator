import 'dotenv/config';
import { bot } from './src/bot.js';
import { initializeWorkers, closeQueues } from './src/shared/scheduler.js';

async function startApp() {
  // Инициализируем воркеры для обработки задач
  initializeWorkers();

  // Запускаем бота
  bot.launch();
  console.log('Bot started!');
}

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down...');
  await closeQueues();
  bot.stop('SIGINT');
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

startApp().catch(console.error);