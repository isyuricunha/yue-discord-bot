import { Redis } from 'ioredis';
import { CONFIG } from '../config';

// Create a single reusable Redis connection for BullMQ
export const redisConnection = new Redis(CONFIG.redis.url, {
	maxRetriesPerRequest: null,
	enableReadyCheck: false,
}) as any;

redisConnection.on('error', (err) => {
	console.error('❌ Redis connection error for BullMQ:', err);
});

redisConnection.on('ready', () => {
	console.log('✅ Redis connected for BullMQ queues');
});
