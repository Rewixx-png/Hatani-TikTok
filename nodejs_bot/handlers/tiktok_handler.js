import axios from 'axios';
import { TIKTOK_API_URL, PUBLIC_SERVER_URL } from '../config.js';
import { cacheManager } from '../cache_manager.js';
import { escapeHTML, getCountryName, formatK, formatTimestamp } from '../utils.js';

const api = axios.create({ baseURL: TIKTOK_API_URL });
const tiktokRegex = /https?:\/\/(?:www\.|vm\.|vt\.)?tiktok\.com\/\S+/;

export function initializeTiktokHandler(bot) {
    bot.onText(tiktokRegex, async (msg, match) => {
        const chatId = msg.chat.id;
        const user = msg.from;
        const userIdentifier = user.username ? `@${user.username}` : `${user.first_name}${user.last_name ? ' ' + user.last_name : ''}`;
        const tiktokUrl = match[0];
        const userComment = (msg.text || '').replace(tiktokUrl, '').trim();
        const commentBlock = userComment ? `\n\n<blockquote expandable>${escapeHTML(userComment)}</blockquote>` : '';
        const sourceLine = `\n\n🔗 via ${escapeHTML(userIdentifier)}`;
        
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
                
                let desc = metadata.desc ? `\n<blockquote expandable>${escapeHTML(metadata.desc)}</blockquote>` : '';
                const authorLine = `› @${escapeHTML(metadata.author?.uniqueId || 'N/A')}`;
                const statsLine = `♥ ${formatK(metadata.stats?.diggCount)} · 💬 ${formatK(metadata.stats?.commentCount)} · ⭐ ${formatK(metadata.stats?.collectCount)} · ↱ ${formatK(metadata.stats?.shareCount)}`;
                const soundLine = `♪ ${metadata.music?.title ? `${escapeHTML(metadata.music.title)} - ${escapeHTML(metadata.music.authorName)}` : 'Original Sound'}`;

                const baseCaption = [authorLine, desc, statsLine, soundLine].filter(Boolean).join('\n\n');
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
                
                const { desc, stats, author, authorStats, video, videoDetails, shazam, music_file_id, id: video_id_meta, locationCreated, createTime } = metadata;

                const authorLine = `› @${escapeHTML(author?.uniqueId || 'N/A')}` + 
                    (authorStats ? `\n  └ Followers: ${formatK(authorStats.followerCount)} · Total Likes: ${formatK(authorStats.heartCount)}` : '');
                
                const descriptionBlock = desc ? `\n<blockquote expandable>${escapeHTML(desc)}</blockquote>` : '';
                
                const statsLine = `♥ ${formatK(stats?.diggCount)} · 💬 ${formatK(stats?.commentCount)} · ↱ ${formatK(stats?.shareCount)} · ▷ ${formatK(stats?.playCount)}`;
                
                const techParts = [
                    video?.duration ? `${video.duration}s` : null,
                    videoDetails?.resolution,
                    videoDetails?.fps ? `${videoDetails.fps} FPS` : null,
                    videoDetails?.size_mb
                ].filter(Boolean);
                const techLine = `[ ${techParts.join(' | ')} ]`;
                
                const metaLine = `◷ ${formatTimestamp(createTime)} · ⌖ ${getCountryName(locationCreated)}`;

                let soundLine = '♪ Original Sound';
                if (shazam?.title && shazam?.title !== 'Неизвестно') {
                    soundLine = `♪ ${escapeHTML(shazam.artist)} - ${escapeHTML(shazam.title)}`;
                }

                const baseCaption = [authorLine, descriptionBlock, statsLine, techLine, metaLine, soundLine].filter(Boolean).join('\n\n');
                const finalCaption = `${baseCaption}${sourceLine}${commentBlock}`.trim();

                const options = { chat_id: chatId, message_id: sentVideoMsg.message_id, parse_mode: 'HTML' };
                if (music_file_id && video_id_meta) {
                    const musicDownloadUrl = `${PUBLIC_SERVER_URL}/download/${video_id_meta}/${music_file_id}`;
                    options.reply_markup = { inline_keyboard: [[{ text: '🎵 Download Track (Shazam)', url: musicDownloadUrl }]] };
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