import axios from 'axios';
import { TIKTOK_API_URL } from '../config.js';
import { cacheManager } from '../cache_manager.js';
import { escapeHTML, getCountryName, formatK, formatTimestamp } from '../utils.js';

const api = axios.create({ baseURL: TIKTOK_API_URL });
const tiktokRegex = /https?:\/\/(?:www\.|vm\.|vt\.|t\.)?tiktok\.com\/\S+|https?:\/\/(?:www\.)?douyin\.com\/\S+/;

async function processTikTokLink(bot, msg, match) {
    const chatId = msg.chat.id;
    const user = msg.from;
    const userIdentifier = user.username ? `@${user.username}` : `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`;
    const tiktokUrl = match[0];
    const userComment = (msg.text || '').replace(tiktokUrl, '').trim();
    const commentBlock = userComment ? `\n\n<blockquote expandable>${escapeHTML(userComment)}</blockquote>` : '';
    const sourceLine = `\n\n🔗 via ${escapeHTML(userIdentifier)}`;

    let waitingMsg;
    const startTime = Date.now();

    try {
        await bot.deleteMessage(chatId, msg.message_id);

        // --- ПРОВЕРКА КЭША ---
        const cachedData = cacheManager.get(tiktokUrl);
        if (cachedData) {
            console.log(`[${chatId}] Кэш HIT по URL: ${tiktokUrl}`);
            await sendFromCache(bot, chatId, cachedData, sourceLine, commentBlock);
            return;
        }

        waitingMsg = await bot.sendMessage(chatId, '⏳ Этап 1: Получение ссылки...');
        
        // --- ЭТАП 1: Мгновенная отправка ---
        const minimalResponse = await api.get('/api/hybrid/video_data', { params: { url: tiktokUrl, minimal: true }, timeout: 60000 });
        const minimalData = minimalResponse.data.data;

        if (!minimalData || !minimalData.type || (!minimalData.video_data && !minimalData.image_data)) {
            throw new Error("API вернул невалидные или пустые данные. Возможно, ссылка нерабочая или сервер TikTok не отвечает.");
        }

        let sentMessage;
        const tempCaption = "⏳ <i>Этап 2: Загрузка основной информации...</i>";
        const videoId = minimalData.video_id;

        // Проверка кэша по videoId, если по URL не нашли
        const cachedById = cacheManager.get(videoId);
        if (cachedById) {
            console.log(`[${chatId}] Кэш HIT по ID: ${videoId}`);
            await sendFromCache(bot, chatId, cachedById, sourceLine, commentBlock);
            await bot.deleteMessage(chatId, waitingMsg.message_id);
            cacheManager.set(tiktokUrl, cachedById); // Кэшируем и по URL тоже для будущих хитов
            return;
        }

        if (minimalData.type === 'video') {
            const videoUrl = minimalData.video_data.nwm_video_url_HQ;
            sentMessage = await bot.sendVideo(chatId, videoUrl, { caption: tempCaption, parse_mode: 'HTML' });
        } else if (minimalData.type === 'image') {
            const imageUrls = minimalData.image_data.no_watermark_image_list;
            const mediaGroup = imageUrls.map(url => ({ type: 'photo', media: url }));
            if (mediaGroup.length > 0) {
                mediaGroup[0].caption = tempCaption;
                mediaGroup[0].parse_mode = 'HTML';
            }
            const sentMessages = await bot.sendMediaGroup(chatId, mediaGroup);
            sentMessage = sentMessages[0];
        } else {
            throw new Error('Неподдерживаемый тип контента от API.');
        }
        await bot.deleteMessage(chatId, waitingMsg.message_id);

        // --- ЭТАП 2: Загрузка основной информации ---
        const fullResponse = await api.get('/api/hybrid/video_data', { params: { url: tiktokUrl, minimal: false }, timeout: 60000 });
        const metadata = fullResponse.data.data;
        
        if (!metadata) {
            console.error(`Не удалось получить полные данные для ${tiktokUrl}`);
            return; 
        }

        let captionParts = buildCaption(metadata, null);
        let currentCaption = captionParts.join('\n\n') + sourceLine + commentBlock + `\n\n⚙️ <i>Этап 3: Анализ видеофайла...</i>`;
        
        await bot.editMessageCaption(currentCaption, {
            chat_id: chatId,
            message_id: sentMessage.message_id,
            parse_mode: 'HTML'
        });
        
        // --- ЭТАП 3: Анализ видеофайла и кэширование ---
        let finalCaption;
        let cacheData;

        if (minimalData.type === 'video') {
            const videoUrlForAnalysis = minimalData.video_data.nwm_video_url_HQ;
            const extraDataResponse = await api.post('/api/analyzer/video_extra_data', { url: videoUrlForAnalysis });
            const extraData = extraDataResponse.data;

            captionParts = buildCaption(metadata, extraData);
            const baseCaption = captionParts.join('\n\n');
            const endTime = Date.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            const timeLine = `\n\n⏱️ Processed in ${processingTime}s`;
            finalCaption = baseCaption + sourceLine + commentBlock + timeLine;
            
            cacheData = { type: 'video', file_id: sentMessage.video.file_id, caption: baseCaption };
            
        } else { // Для фотоальбомов
            captionParts = buildCaption(metadata, null);
            const baseCaption = captionParts.join('\n\n');
            const endTime = Date.now();
            const processingTime = ((endTime - startTime) / 1000).toFixed(2);
            const timeLine = `\n\n⏱️ Processed in ${processingTime}s`;
            finalCaption = baseCaption + sourceLine + commentBlock + timeLine;
            
            const file_ids = sentMessage.photo.map(p => p.file_id);
            cacheData = { type: 'photo', file_ids, caption: baseCaption };
        }

        await bot.editMessageCaption(finalCaption, {
            chat_id: chatId,
            message_id: sentMessage.message_id,
            parse_mode: 'HTML'
        });

        // Сохраняем в кэш
        cacheManager.set(videoId, cacheData);
        cacheManager.set(tiktokUrl, cacheData);
        console.log(`[${chatId}] Сохранено в кэш: ${videoId} и ${tiktokUrl}`);

    } catch (error) {
        const endTime = Date.now();
        const processingTime = ((endTime - startTime) / 1000).toFixed(2);
        const errorBody = error.response?.data?.detail || error.message || 'Неизвестная ошибка';
        console.error(`[${chatId}] ГЛОБАЛЬНАЯ ОШИБКА:`, error.response?.data || error);
        const errorText = `❌ Ошибка: ${errorBody}\n⏱️ Время: ${processingTime}s`;
        if (waitingMsg) {
            await bot.editMessageText(errorText, { chat_id: chatId, message_id: waitingMsg.message_id });
        } else {
            await bot.sendMessage(chatId, errorText);
        }
    }
}

async function sendFromCache(bot, chatId, cachedData, sourceLine, commentBlock) {
    const finalCaption = `${cachedData.caption}${sourceLine}${commentBlock}`.trim();
    if (cachedData.type === 'video') {
        await bot.sendVideo(chatId, cachedData.file_id, { caption: finalCaption, parse_mode: 'HTML' });
    } else if (cachedData.type === 'photo') {
        const mediaGroup = cachedData.file_ids.map(id => ({ type: 'photo', media: id }));
        if (mediaGroup.length > 0) {
            mediaGroup[0].caption = finalCaption;
            mediaGroup[0].parse_mode = 'HTML';
        }
        for (let i = 0; i < mediaGroup.length; i += 10) {
            await bot.sendMediaGroup(chatId, mediaGroup.slice(i, i + 10));
        }
    }
}

function buildCaption(metadata, extraData) {
    const captionParts = [];
    const author = metadata.author || {};
    
    let authorLine = `› @${escapeHTML(author.unique_id || author.nickname)}`;
    if (author.follower_count !== undefined && author.total_favorited !== undefined) {
        authorLine += `\n  └ Followers: ${formatK(author.follower_count)} · Total Likes: ${formatK(author.total_favorited)}`;
    }
    captionParts.push(authorLine);

    if (metadata.desc) {
        captionParts.push(`\n<blockquote expandable>${escapeHTML(metadata.desc)}</blockquote>`);
    }
    
    const stats = metadata.statistics || {};
    const statsLine = `♥ ${formatK(stats.digg_count)} · 💬 ${formatK(stats.comment_count)} · ↱ ${formatK(stats.share_count)} · ▷ ${formatK(stats.play_count)}`;
    captionParts.push(statsLine);

    const videoInfo = metadata.video || {};
    const techParts = [
        videoInfo.duration ? `${Math.round(videoInfo.duration / 1000)}s` : null,
        videoInfo.width && videoInfo.height ? `${videoInfo.width}x${videoInfo.height}` : null,
        extraData?.fps ? `${extraData.fps} FPS` : null,
        extraData?.size_mb ? extraData.size_mb : null
    ].filter(Boolean);

    if(techParts.length > 0) captionParts.push(`[ ${techParts.join(' | ')} ]`);

    const metaLine = `◷ ${formatTimestamp(metadata.create_time)} · ⌖ ${getCountryName(metadata.region)}`;
    captionParts.push(metaLine);
    
    const soundLine = `♪ ${metadata.music && metadata.music.title && !metadata.music.title.startsWith('original sound') ? escapeHTML(metadata.music.title) : 'Original Sound'}`;
    captionParts.push(soundLine);

    return captionParts;
}

export function initializeTiktokHandler(bot) {
    bot.onText(tiktokRegex, (msg, match) => {
        processTikTokLink(bot, msg, match);
    });
}