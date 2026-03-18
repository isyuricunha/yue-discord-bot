import { Redis } from 'ioredis';
import { CONFIG } from '../config';

export function resolve_redis_password(redis_url: string, redis_password: string | undefined): string | undefined {
	const url_has_password = (() => {
		try {
			const parsed = new URL(redis_url)
			return typeof parsed.password === 'string' && parsed.password.length > 0
		} catch {
			return false
		}
	})()

	if (url_has_password) return undefined
	const trimmed = (redis_password ?? '').trim()
	return trimmed.length > 0 ? trimmed : undefined
}

let redis_connection: Redis | null = null
let has_bound_listeners = false

export function get_redis_connection(): Redis {
	if (redis_connection) return redis_connection

	const redis_password = resolve_redis_password(CONFIG.redis.url, process.env.REDIS_PASSWORD)

	redis_connection = new Redis(CONFIG.redis.url, {
		maxRetriesPerRequest: null,
		enableReadyCheck: false,
		...(redis_password ? { password: redis_password } : {}),
	})

	if (!has_bound_listeners) {
		has_bound_listeners = true
		redis_connection.on('error', (err) => {
			console.error('❌ Redis connection error for BullMQ:', err);
		})

		redis_connection.on('ready', () => {
			console.log('✅ Redis connected for BullMQ queues');
		})
	}

	return redis_connection
}
