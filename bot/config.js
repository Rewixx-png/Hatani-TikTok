import dotenv from 'dotenv';
dotenv.config();

export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
export const TIKTOK_API_URL = process.env.TIKTOK_API_URL;
export const PUBLIC_SERVER_URL = process.env.PUBLIC_SERVER_URL; // Может понадобиться для кнопок
export const TELEGRAM_API_URL = 'https://api.telegram.org';