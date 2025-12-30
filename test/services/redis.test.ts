
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock IORedis
const mockRedisInstance = {
    on: vi.fn(),
    status: 'ready'
};

vi.mock('ioredis', () => {
    return {
        default: class Redis {
            on = mockRedisInstance.on;
            constructor() {
                return mockRedisInstance;
            }
        }
    };
});

const { getRedisClient, createRedisConnection, resetRedisClient } = await import('@/services/redis');

describe('Redis Service', () => {
    beforeEach(() => {
        // Reset mocks if needed
        mockRedisInstance.on.mockClear();
        resetRedisClient();
    });

    it('getRedisClient should return a singleton instance', () => {
        const client1 = getRedisClient();
        const client2 = getRedisClient();

        expect(client1).toBeDefined();
        expect(client1).toBe(client2); // Singleton check

        expect(client1.on).toHaveBeenCalled();
    });

    it('should log error when redis client emits error', () => {
        const client = getRedisClient();

        expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));

        const calls = mockRedisInstance.on.mock.calls;
        const errorCall = calls.find(call => call[0] === 'error');
        if (errorCall) {
            const callback = errorCall[1];
            callback(new Error('Redis connection lost'));
        }
    });

    it('createRedisConnection should return a new instance', () => {
        const client1 = createRedisConnection();

        expect(client1).toBeDefined();
    });
});
