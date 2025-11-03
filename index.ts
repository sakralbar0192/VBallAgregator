import 'dotenv/config';
import { bot } from './src/bot.js';

bot.launch();

console.log('Bot started!');

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));