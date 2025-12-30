
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis Service
const { mockLpush } = vi.hoisted(() => ({ mockLpush: vi.fn() }));

vi.mock('@/services/redis', () => ({
    createRedisConnection: () => ({
        lpush: mockLpush,
        on: vi.fn(),
        subscribe: vi.fn()
    })
}));

// Mock Logger
vi.mock('@/utils/logger', () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn()
    }
}));

import { addAudioJob } from '@/queue/index';
import { logger } from '@/utils/logger';

describe('Queue Service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should add audio job to redis queue', async () => {
        mockLpush.mockResolvedValue(1);

        const fileId = 'file-123';
        const filePath = 'path/to/file';
        const userId = 'user-123';

        const result = await addAudioJob(fileId, filePath, userId);

        expect(result).toHaveProperty('id');
        expect(mockLpush).toHaveBeenCalledWith(
            'audio_queue',
            expect.stringContaining(fileId)
        );
        expect(logger.info).toHaveBeenCalled();
    });

    it('should throw error and log if redis fails', async () => {
        const error = new Error('Redis Error');
        mockLpush.mockRejectedValue(error);

        await expect(addAudioJob('f', 'p', 'u')).rejects.toThrow('Redis Error');
        expect(logger.error).toHaveBeenCalled();
    });
});
