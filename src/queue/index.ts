
import { randomUUID } from 'crypto';

import { createRedisConnection } from '../services/redis';
import { logger } from '../utils/logger';

/**
 * Redis connection instance dedicated to the audio processing queue.
 */
export const audioQueue = createRedisConnection();
const QUEUE_NAME = 'audio_queue';

/**
 * Pushes a new audio processing job to the Redis queue.
 *
 * It generates a unique task ID and pushes the job payload (file ID, path, user ID)
 * to the `audio_queue` list for the Python worker to consume.
 *
 * @param fileId - Unique identifier for the file (UUID).
 * @param filePath - The key/path of the file in MinIO storage.
 * @param userId - The ID of the user submitting the job.
 * @returns An object containing the generated task ID.
 * @throws If the Redis operation fails.
 */
export const addAudioJob = async (fileId: string, filePath: string, userId: string, questionId: string): Promise<{ id: string }> => {
    try {
        const taskId = randomUUID();
        const payload = JSON.stringify({ fileId, filePath, taskId, userId, questionId });
        const seq = await audioQueue.lpush(QUEUE_NAME, payload);

        logger.info(`Job added to redis list`, { seq, fileId, taskId });

        return { id: taskId };
    } catch (error) {
        logger.error(`Failed to add job to queue`, { error });
        throw error;
    }
};
