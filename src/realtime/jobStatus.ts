
import type { ServerWebSocket } from 'bun';
import type { Redis } from 'ioredis';

import { createRedisConnection } from '../services/redis';
import { logger } from '../utils/logger';

/**
 * Payload structure for job status updates dispatched via Redis.
 */
type StatusPayload = {
    taskId?: string;
    fileId?: string;
    userId?: string;
    status?: string;
    message?: string;
};

/**
 * Metadata associated with a WebSocket connection.
 */
type SocketMeta = {
    taskId: string | null;
    userId: string;
    scope: 'task' | 'user';
};

const CHANNEL = process.env.JOB_STATUS_CHANNEL || 'job_status';

/**
 * Manages real-time job status updates via WebSockets.
 *
 * This class handles:
 * 1. Subscribing to Redis channels for job events (started, processing, completed, failed).
 * 2. Maintaining a registry of active WebSocket clients, indexed by task ID or user ID.
 * 3. Broadcasting received events to the appropriate connected clients.
 *
 * It supports two modes of subscription:
 * - Task-specific: Clients only receive updates for a specific `taskId`.
 * - User-scoped: Clients receive updates for any job belonging to a specific `userId`.
 */
export class JobStatusHub {
    private readonly subscriber: Redis;

    private readonly taskSubscribers = new Map<string, Set<ServerWebSocket>>();
    private readonly userSubscribers = new Map<string, Set<ServerWebSocket>>();

    private readonly socketMeta = new WeakMap<ServerWebSocket, SocketMeta>();

    /**
     * Initializes the JobStatusHub.
     * Sets up the Redis subscriber connection and listens for messages on the configured channel.
     */
    constructor() {
        this.subscriber = createRedisConnection();
        this.subscriber.on('error', (error) => {
            logger.error('Redis subscriber error', { error });
        });
        this.subscriber.subscribe(CHANNEL, (error) => {
            if (error) {
                logger.error('Failed to subscribe to job status channel', { error });
            } else {
                logger.info('Subscribed to job status channel', { channel: CHANNEL });
            }
        });
        this.subscriber.on('message', (_channel, message) => {
            this.handleMessage(message);
        });
    }

    /**
     * Registers a new WebSocket subscriber.
     *
     * Depending on the provided `taskId`, the socket is either subscribed to a specific task
     * or to all updates for the given `userId`.
     *
     * @param taskId - The specific task ID to watch, or 'all' (or undefined) to watch all user tasks.
     * @param userId - The ID of the authenticated user owning the socket.
     * @param socket - The WebSocket connection instance.
     */
    addSubscriber(taskId: string | undefined, userId: string, socket: ServerWebSocket): void {
        const normalizedUser = (userId || '').trim();
        const normalizedTask = (taskId || '').trim();

        if (!normalizedUser) {
            socket.close(1008, 'Missing user id');

            return;
        }

        if (!normalizedTask || normalizedTask === 'all') {
            let sockets = this.userSubscribers.get(normalizedUser);

            if (!sockets) {
                sockets = new Set();
                this.userSubscribers.set(normalizedUser, sockets);
            }
            sockets.add(socket);
            this.socketMeta.set(socket, {
                taskId: null,
                userId: normalizedUser,
                scope: 'user',
            });
            logger.info('WebSocket subscribed to user job updates');

            return;
        }

        let sockets = this.taskSubscribers.get(normalizedTask);

        if (!sockets) {
            sockets = new Set();
            this.taskSubscribers.set(normalizedTask, sockets);
        }
        sockets.add(socket);
        this.socketMeta.set(socket, {
            taskId: normalizedTask,
            userId: normalizedUser,
            scope: 'task',
        });
        logger.info('WebSocket subscribed to job updates', { taskId: normalizedTask });
    }

    /**
     * Removes a WebSocket subscriber and cleans up internal references.
     *
     * This method ensures that disconnected sockets are removed from their respective
     * task-based or user-based subscription sets to prevent memory leaks and zombie connections.
     *
     * @param socket - The WebSocket connection to remove.
     */
    removeSocket(socket: ServerWebSocket): void {
        const meta = this.socketMeta.get(socket);

        if (!meta) {
            return;
        }
        if (meta.scope === 'task' && meta.taskId) {
            const sockets = this.taskSubscribers.get(meta.taskId);

            if (sockets) {
                sockets.delete(socket);
                if (sockets.size === 0) {
                    this.taskSubscribers.delete(meta.taskId);
                }
            }
        } else {
            const sockets = this.userSubscribers.get(meta.userId);

            if (sockets) {
                sockets.delete(socket);
                if (sockets.size === 0) {
                    this.userSubscribers.delete(meta.userId);
                }
            }
        }
        this.socketMeta.delete(socket);
    }

    /**
     * Parses an incoming Redis payload and broadcasts it to interested sockets.
     * @param rawPayload - JSON string containing job status data.
     */
    private handleMessage(rawPayload: string): void {
        let payload: StatusPayload;

        try {
            payload = JSON.parse(rawPayload);
        } catch {
            logger.warn('Failed to parse job status payload', { rawPayload });

            return;
        }

        logger.info('Received job status payload', {
            payload,
            taskSubscribers: this.taskSubscribers.size,
            userSubscribers: this.userSubscribers.size,
        });

        const delivered = new Set<ServerWebSocket>();
        const sendTo = (sockets?: Set<ServerWebSocket>): void => {
            if (!sockets || sockets.size === 0) {
                return;
            }
            for (const socket of sockets) {
                if (delivered.has(socket)) {
                    continue;
                }
                const meta = this.socketMeta.get(socket);

                if (!meta) {
                    continue;
                }
                if (payload.userId && payload.userId !== meta.userId) {
                    continue;
                }
                if (socket.readyState !== 1) { // 1 is OPEN
                    this.removeSocket(socket);
                    continue;
                }
                try {
                    socket.send(JSON.stringify(payload));
                    delivered.add(socket);
                } catch (error) {
                    logger.warn('Failed to send status payload', { error });
                    this.removeSocket(socket);
                }
            }
        };

        if (payload.taskId) {
            sendTo(this.taskSubscribers.get(payload.taskId));
        }
        if (payload.userId) {
            sendTo(this.userSubscribers.get(payload.userId));
        }
    }
}

export const jobStatusHub = new JobStatusHub();
