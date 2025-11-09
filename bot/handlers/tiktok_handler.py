import axios from 'axios';
import { TIKTOK_API_URL } from '../config.js';
import { cacheManager } from '../cache_manager.js';
import { escapeHTML, getCountryName, formatK, formatTimestamp } from '../utils.js';

const api = axios.create({ baseURL: TIKTOK_API_URL });
const tiktokRegex = /https?:\/\/(?:www\.|vm\.|vt\.|t\.)?tiktok\.com\/\S+|https?:\/\/(?:www\.)?douyin\.com\/\S+/;

// Функция для обработки любой TikTok/Douyin ссылки
async function processTikTokLink(bot, msg, match) {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userIdentifier = user.username ? `@${user.username}` : `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`;
    const tiktokUrl = match[0];
    const userComment = (msg.text || '').replace(tiktokUrl, '').trim();
    const commentBlock = userComment ? `\n\n<blockquote expandable>${escapeHTML(userComment)}</blockquote>` : '';
    const sourceLine = `\n\n🔗 via ${escapeHTML(userIdentifier)}`;

    let waitingMsg;
    try {
        // У нового API видео ID это и есть ключ кэша, так что отдельный запрос не нужен.
        // Попробуем сначала получить из кэша по самой ссылке, если нет - то уже будем парсить
        const cachedByUrl = cacheManager.get(tiktokUrl);
        if (cachedByUrl) {
            console.log(`[${chatId}] Кэш HIT по URL: ${tiktokUrl}`);
            await sendFromCache(bot, chatId, msg.message_id, cachedByUrl, sourceLine, commentBlock);
            await bot.deleteMessage(chatId, msg.message_id);
            return;
        }

        waitingMsg = await bot.sendMessage(chatId, '⏳ Анализирую ссылку...', { reply_to_message_id: msg.message_id });
        
        const response = await api.get('/api/hybrid/video_data', { params: { url: tiktokUrl, minimal: true }, timeout: 60000 });
        const metadata = response.data.data;

        if (!metadata) {
            throw new Error("API вернул пустые данные.");
        }

        const videoId = metadata.video_id;
        const platform = metadata.platform;

        // Обработка видео
        if (metadata.type === 'video') {
            await bot.editMessageText('✅ Видео получено. Отправляю...', { chat_id: chatId, message_id: waitingMsg.message_id });
            const videoUrl = metadata.video_data.nwm_video_url_HQ;
            
            const captionParts = [];
            
            const author = metadata.author || {};
            captionParts.push(`› @${escapeHTML(author.nickname || author.unique_id)}`);
            if (author.follower_count && author.total_favorited) {
                 captionParts.push(`  └ Followers: ${formatK(author.follower_count)} · Total Likes: ${formatK(author.total_favorited)}`);
            }

            if (metadata.desc) {
                captionParts.push(`\n<blockquote expandable>${escapeHTML(metadata.desc)}</blockquote>`);
            }
            
            const stats = metadata.statistics || {};
            const statsLine = `♥ ${formatK(stats.digg_count)} · 💬 ${formatK(stats.comment_count)} · ↱ ${formatK(stats.share_count)} · ▷ ${formatK(stats.play_count)}`;
            captionParts.push(statsLine);

            const videoData = metadata.video_data || {};
            const techParts = [
                videoData.duration ? `${Math.round(videoData.duration / 1000)}s` : null,
                videoData.width && videoData.height ? `${videoData.width}x${videoData.height}` : null
            ].filter(Boolean);
            if(techParts.length > 0) captionParts.push(`[ ${techParts.join(' | ')} ]`);

            const metaLine = `◷ ${formatTimestamp(metadata.create_time)} · ⌖ ${getCountryName(metadata.region)}`;
            captionParts.push(metaLine);
            
            const soundLine = `♪ ${metadata.music.title ? escapeHTML(metadata.music.title) : 'Original Sound'}`;
            captionParts.push(soundLine);

            const baseCaption = captionParts.join('\n\n');
            const finalCaption = `${baseCaption}${sourceLine}${commentBlock}`.trim();

            const sentVideoMsg = await bot.sendVideo(chatId, videoUrl, { caption: finalCaption, parse_mode: 'HTML', reply_to_message_id: msg.message_id });

            // Кэшируем результат
            cacheManager.set(videoId, { type: 'video', file_id: sentVideoMsg.video.file_id, caption: baseCaption });
            cacheManager.set(tiktokUrl, { type: 'video', file_id: sentVideoMsg.video.file_id, caption: baseCaption });

        // Обработка фото-альбомов
        } else if (metadata.type === 'image') {
            const images = metadata.image_data.no_watermark_image_list;
            await bot.editMessageText(`✅ Альбом получен. Отправляю ${images.length} фото...`, { chat_id: chatId, message_id: waitingMsg.message_id });

            const author = metadata.author || {};
            const stats = metadata.statistics || {};
            const music = metadata.music || {};
            
            const captionParts = [];
            captionParts.push(`› @${escapeHTML(author.nickname || author.unique_id)}`);
            if (metadata.desc) {
                captionParts.push(`\n<blockquote expandable>${escapeHTML(metadata.desc)}</blockquote>`);
            }
            const statsLine = `♥ ${formatK(stats.digg_count)} · 💬 ${formatK(stats.comment_count)} · ↱ ${formatK(stats.share_count)}`;
            captionParts.push(statsLine);
            const soundLine = `♪ ${music.title ? escapeHTML(music.title) : 'Original Sound'}`;
            captionParts.push(soundLine);
            
            const baseCaption = captionParts.join('\n\n');
            const finalCaption = `${baseCaption}${sourceLine}${commentBlock}`.trim();
            
            const mediaGroup = images.map(url => ({ type: 'photo', media: url }));
            if (mediaGroup.length > 0) {
                mediaGroup[0].caption = finalCaption;
                mediaGroup[0].parse_mode = 'HTML';
            }
            
            const sentMessages = await bot.sendMediaGroup(chatId, mediaGroup, { reply_to_message_id: msg.message_id });
            const file_ids = sentMessages.map(m => m.photo[m.photo.length - 1].file_id);
            
            cacheManager.set(videoId, { type: 'photo', file_ids: file_ids, caption: baseCaption });
            cacheManager.set(tiktokUrl, { type: 'photo', file_ids: file_ids, caption: baseCaption });
        } else {
            throw new Error('Неподдерживаемый тип контента.');
        }

        await bot.deleteMessage(chatId, waitingMsg.message_id);
        await bot.deleteMessage(chatId, msg.message_id);

    } catch (error) {
        const errorBody = error.response?.data?.message || error.message || 'Неизвестная ошибка';
        console.error(`[${chatId}] ГЛОБАЛЬНАЯ ОШИБКА:`, error.response?.data || error);
        const errorText = `❌ Ошибка: ${errorBody}`;
        if (waitingMsg) {
            await bot.editMessageText(errorText, { chat_id: chatId, message_id: waitingMsg.message_id });
        } else {
            await bot.sendMessage(chatId, errorText, { reply_to_message_id: msg.message_id });
        }
    }
}

async function sendFromCache(bot, chatId, replyToId, cachedData, sourceLine, commentBlock) {
    const finalCaption = `${cachedData.caption}${sourceLine}${commentBlock}`.trim();
    if (cachedData.type === 'video') {
        await bot.sendVideo(chatId, cachedData.file_id, { caption: finalCaption, parse_mode: 'HTML', reply_to_message_id: replyToId });
    } else if (cachedData.type === 'photo') {
        const mediaGroup = cachedData.file_ids.map(id => ({ type: 'photo', media: id }));
        if (mediaGroup.length > 0) {
            mediaGroup[0].caption = finalCaption;
            mediaGroup[0].parse_mode = 'HTML';
        }
        for (let i = 0; i < mediaGroup.length; i += 10) {
            await bot.sendMediaGroup(chatId, mediaGroup.slice(i, i + 10), { reply_to_message_id: replyToId });
        }
    }
}

export function initializeTiktokHandler(bot) {
    bot.onText(tiktokRegex, (msg, match) => processTikTokLink(bot, msg, match));
}