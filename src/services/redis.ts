
import IORedis, { type Redis,type RedisOptions } from 'ioredis';

import { logger } from '../utils/logger';

const redisConfig: RedisOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
};

let client: Redis | null = null;

/**
 * Returns a singleton Redis client instance.
 *
 * This client is intended for general-purpose Redis operations (caching, simple keys).
 * For queue processing (BullMQ), use `createRedisConnection` to avoid blocking issues.
 *
 * @returns The active Redis instance.
 */
export const getRedisClient = (): Redis => {
    if (!client) {
        client = new IORedis(redisConfig);
        client.on('error', (error) => {
            logger.error('Redis connection error', { error });
        });
    }

    return client;
};

export const resetRedisClient = (): void => {
    client = null;
};

/**
 * Creates a new, isolated Redis connection.
 *
 * Required for BullMQ workers and schedulers, as they require blocking connections
 * that cannot be shared with the general-purpose singleton client.
 *
 * @returns A new IORedis client instance.
 */
export const createRedisConnection = (): Redis => new IORedis(redisConfig);
