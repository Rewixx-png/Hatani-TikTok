import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';

const CACHE_TTL = 60 * 60 * 1000; // 1 час в миллисекундах

class CacheManager {
    constructor() {
        this.db = null;
    }

    async init() {
        const adapter = new JSONFile('db.json');
        this.db = new Low(adapter, { videos: {} });
        await this.db.read();
        console.log('Файловый кэш инициализирован.');
    }

    get(key) {
        if (!this.db || !this.db.data.videos) return null;
        const entry = this.db.data.videos[key];
        if (!entry) {
            return null;
        }
        
        if (Date.now() - entry.timestamp > CACHE_TTL) {
            console.log(`[Кэш] Запись для ${key} устарела.`);
            delete this.db.data.videos[key];
            this.db.write();
            return null;
        }
        return entry.data;
    }

    async set(key, value) {
        if (!this.db || !this.db.data.videos) await this.init();
        this.db.data.videos[key] = {
            data: value,
            timestamp: Date.now()
        };
        await this.db.write();
    }
}

export const cacheManager = new CacheManager();
