import dotenv from 'dotenv';
dotenv.config();

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const TIKTOK_API_URL = process.env.TIKTOK_API_URL;
export const PUBLIC_SERVER_URL = process.env.PUBLIC_SERVER_URL;
export const TELEGRAM_API_URL = process.env.TELEGRAM_API_URL;

if (!TELEGRAM_BOT_TOKEN || !TIKTOK_API_URL || !PUBLIC_SERVER_URL) {
    console.error("Критическая ошибка: не все переменные окружения заданы! (TELEGRAM_BOT_TOKEN, TIKTOK_API_URL, PUBLIC_SERVER_URL)");
    process.exit(1);
}