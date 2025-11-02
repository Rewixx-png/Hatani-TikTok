import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const file = path.join(__dirname, 'db.json');

const adapter = new JSONFile(file);
const defaultData = { videos: {} };
const db = new Low(adapter, defaultData);

export const cacheManager = {
    async init() {
        await db.read();
        console.log('Файловый кэш (lowdb) инициализирован.');
    },
    get(videoId) {
        return db.data.videos[videoId] || null;
    },
    async set(videoId, data) {
        db.data.videos[videoId] = data;
        await db.write();
    }
};