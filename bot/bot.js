import TelegramBot from 'node-telegram-bot-api';
import { TELEGRAM_BOT_TOKEN, TELEGRAM_API_URL } from './config.js';
import { cacheManager } from './cache_manager.js';
import { initializeTiktokHandler } from './handlers/tiktok_handler.js';

// Инициализация бота
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
    polling: true,
    baseApiUrl: TELEGRAM_API_URL,
    request: { timeout: 60000 }
});

// Асинхронная самовызывающаяся функция для инициализации
(async () => {
    // Инициализация файлового кэша
    await cacheManager.init();

    // Инициализация обработчика TikTok ссылок
    initializeTiktokHandler(bot);

    // Обработка ошибок опроса
    bot.on('polling_error', (error) => console.error('Ошибка опроса:', error.code, '-', error.message));

    console.log('Бот запущен и готов к работе...');
})();
