// redis.ts
import { Redis } from 'ioredis';

declare global {
    // eslint-disable-next-line no-var
    var __redis: Redis | undefined;
}

export const redis =
    global.__redis ??
    new Redis(process.env.REDIS_URL!, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
    });

if (!global.__redis) {
    global.__redis = redis;

    redis.on('ready', () => {
        console.log('✅ Redis connected');
    });

    redis.on('error', (err) => {
        console.error('❌ Redis error:', err.message);
    });

    redis.on('reconnecting', () => {
        console.log('🔄 Redis reconnecting...');
    });
}

