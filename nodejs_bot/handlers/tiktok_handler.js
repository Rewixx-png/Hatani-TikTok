import axios from 'axios';
import { TIKTOK_API_URL, PUBLIC_SERVER_URL } from '../config.js';
import { cacheManager } from '../cache_manager.js';
import { escapeHTML, getCountryName, formatNumber, formatTimestamp } from '../utils.js';

const api = axios.create({ baseURL: TIKTOK_API_URL });
const tiktokRegex = /https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/\S+/;

export function initializeTiktokHandler(bot) {
    bot.onText(tiktokRegex, async (msg, match) => {
        const chatId = msg.chat.id;
        const user = msg.from;
        const userIdentifier = user.username ? `@${user.username}` : `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`;
        const sourceLine = `\n\n🔗 <b>Ссылка от:</b> ${escapeHTML(userIdentifier)}`;
        const tiktokUrl = match[0];
        const userComment = (msg.text || '').replace(tiktokUrl, '').trim();
        let commentBlock = userComment ? `\n\n📝 <b>Комментарий:</b>\n<blockquote expandable>${escapeHTML(userComment)}</blockquote>` : '';
        
        let waitingMsg;
        try {
            const idResponse = await api.get('/get_video_id', { params: { url: tiktokUrl } });
            const videoId = idResponse.data.video_id;

            const cached = cacheManager.get(videoId);
            if (cached) {
                console.log(`[${chatId}] Кэш HIT для video_id: ${videoId}`);
                const finalCaption = `${cached.caption}${sourceLine}${commentBlock}`.trim();

                if (cached.type === 'video') {
                    await bot.sendVideo(chatId, cached.file_id, { caption: finalCaption, parse_mode: 'HTML', reply_to_message_id: msg.message_id, reply_markup: cached.reply_markup });
                } else if (cached.type === 'photo') {
                    const mediaGroup = cached.file_ids.map(id => ({ type: 'photo', media: id }));
                    if (mediaGroup.length > 0) {
                        mediaGroup[0].caption = finalCaption;
                        mediaGroup[0].parse_mode = 'HTML';
                    }
                    for (let i = 0; i < mediaGroup.length; i += 10) {
                        await bot.sendMediaGroup(chatId, mediaGroup.slice(i, i + 10), { reply_to_message_id: msg.message_id });
                    }
                }
                await bot.deleteMessage(chatId, msg.message_id);
                return;
            }

            console.log(`[${chatId}] Кэш MISS для video_id: ${videoId}. Запрашиваю полные данные...`);
            waitingMsg = await bot.sendMessage(chatId, '⏳ В кэше не найдено. Запрашиваю данные...', { reply_to_message_id: msg.message_id });
            
            const response = await api.get('/video_data', { params: { original_url: tiktokUrl }, timeout: 180000 });
            const { metadata, videoBase64, image_paths } = response.data;
            
            if (image_paths && image_paths.length > 0) {
                await bot.editMessageText(`✅ Данные получены. Отправляю ${image_paths.length} фото...`, { chat_id: chatId, message_id: waitingMsg.message_id });
                let rawDesc = metadata.desc || '';
                const header = `<b>Автор:</b> @${escapeHTML(metadata.author?.uniqueId || '')}\n`;
                const stats = metadata.stats || {};
                const music = metadata.music || {};
                const footer = `❤️ ${formatNumber(stats.diggCount)} | 💬 ${formatNumber(stats.commentCount)} | ⭐ ${formatNumber(stats.collectCount)} | 🔁 ${formatNumber(stats.shareCount)}\n\n` + `🎵 <b>Музыка:</b> ${music.title ? `${escapeHTML(music.title)} - ${escapeHTML(music.authorName)}` : '<i>Оригинальный звук</i>'}`;
                const availableLength = 1024 - (header.length + footer.length + sourceLine.length + commentBlock.length) - 100;
                if (rawDesc.length > availableLength) rawDesc = rawDesc.substring(0, availableLength) + '...';
                const descriptionBlock = rawDesc ? `<b>Описание:</b>\n<blockquote expandable>${escapeHTML(rawDesc)}</blockquote>\n\n` : '';
                const baseCaption = `${header}${descriptionBlock}${footer}`.trim();
                const finalCaption = `${baseCaption}${sourceLine}${commentBlock}`.trim();
                const mediaGroup = image_paths.map(url => ({ type: 'photo', media: `${PUBLIC_SERVER_URL}${url}` }));
                mediaGroup[0].caption = finalCaption;
                mediaGroup[0].parse_mode = 'HTML';
                const sentMessages = await bot.sendMediaGroup(chatId, mediaGroup, { reply_to_message_id: msg.message_id });
                const file_ids = sentMessages.map(m => m.photo[m.photo.length - 1].file_id);
                await cacheManager.set(videoId, { type: 'photo', file_ids: file_ids, caption: baseCaption });
                console.log(`[${chatId}] Сохранено в кэш (фото): ${videoId}`);
                await bot.deleteMessage(chatId, waitingMsg.message_id);
            } else if (videoBase64) {
                await bot.deleteMessage(chatId, waitingMsg.message_id);
                await bot.sendChatAction(chatId, 'upload_video');
                const videoBuffer = Buffer.from(videoBase64, 'base64');
                const sentVideoMsg = await bot.sendVideo(chatId, videoBuffer, { caption: '​', reply_to_message_id: msg.message_id });
                let desc = metadata.desc || '';
                const stats = metadata.stats || {};
                const authorStats = metadata.authorStats || {};
                const videoDetails = metadata.videoDetails || {};
                const header = `<b>Автор:</b> @${escapeHTML(metadata.author?.uniqueId || '')}\n` + (authorStats ? `  👥 Подписчиков: ${formatNumber(authorStats.followerCount)}\n  ❤️ Всего лайков: ${formatNumber(authorStats.heartCount)}\n\n` : '\n');
                const statsBlock = `<b>Статистика видео:</b>\n` + `  ❤️ Лайки: ${formatNumber(stats.diggCount)}\n` + `  💬 Комментарии: ${formatNumber(stats.commentCount)}\n` + `  🔁 Репосты: ${formatNumber(stats.shareCount)}\n` + `  ▶️ Просмотры: ${formatNumber(stats.playCount)}\n\n`;
                const detailsBlock = `<b>Детали:</b>\n` + `  📍 <b>Регион:</b> ${getCountryName(metadata.locationCreated)}\n` + `  📅 Опубликовано: ${escapeHTML(formatTimestamp(metadata.createTime))}\n` + (metadata.video?.duration ? `  ⏱️ Длительность: ${metadata.video.duration} сек\n` : '') + (videoDetails.resolution ? `  ⚙️ Разрешение: ${videoDetails.resolution}\n` : '') + (videoDetails.size_mb ? `  💾 Размер: ${escapeHTML(videoDetails.size_mb)}` : '');
                let musicLine = `\n\n🎵 <b>Музыка:</b> <i>Оригинальный звук</i>`;
                if (metadata.shazam?.title && metadata.shazam?.title !== 'Неизвестно') musicLine = `\n\n🎵 <b>Shazam:</b> ${escapeHTML(metadata.shazam.artist)} - ${escapeHTML(metadata.shazam.title)}`;
                const availableLength = 1024 - (header.length + statsBlock + detailsBlock + musicLine + sourceLine.length + commentBlock.length) - 100;
                if (desc.length > availableLength) desc = desc.substring(0, availableLength) + '...';
                const descriptionBlock = desc ? `<b>Описание:</b>\n<blockquote expandable>${escapeHTML(desc)}</blockquote>\n\n` : '';
                const baseCaption = `${header}${descriptionBlock}${statsBlock}${detailsBlock}`.trim() + musicLine;
                const finalCaption = `${baseCaption}${sourceLine}${commentBlock}`.trim();
                const options = { chat_id: chatId, message_id: sentVideoMsg.message_id, parse_mode: 'HTML' };
                if (metadata.music_file_id && metadata.id) {
                    const musicDownloadUrl = `${PUBLIC_SERVER_URL}/download/${metadata.id}/${metadata.music_file_id}`;
                    options.reply_markup = { inline_keyboard: [[{ text: '🎵 Скачать трек (Shazam)', url: musicDownloadUrl }]] };
                }
                await bot.editMessageCaption(finalCaption, options);
                await cacheManager.set(videoId, { type: 'video', file_id: sentVideoMsg.video.file_id, caption: baseCaption, reply_markup: options.reply_markup });
                console.log(`[${chatId}] Сохранено в кэш (видео): ${videoId}`);
            } else {
                 throw new Error("API не вернул ни видео, ни фотоальбом.");
            }
            await bot.deleteMessage(chatId, msg.message_id);
        } catch (error) {
            const errorBody = error.response?.data || error.message || 'Неизвестная ошибка';
            console.error(`[${chatId}] ГЛОБАЛЬНАЯ ОШИБКА:`, errorBody);
            const errorText = (typeof errorBody === 'object' && errorBody.detail) ? `❌ Ошибка: ${errorBody.detail}` : '❌ Произошла критическая ошибка. Попробуйте позже.';
            if (waitingMsg) {
                await bot.editMessageText(errorText, { chat_id: chatId, message_id: waitingMsg.message_id });
            } else {
                await bot.sendMessage(chatId, errorText, { reply_to_message_id: msg.message_id });
            }
        }
    });
}