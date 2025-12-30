
import 'winston-daily-rotate-file';

import { AsyncLocalStorage } from 'async_hooks';
import winston from 'winston';

/**
 * Async Context Storage to hold request-specific metadata (requestId, userId)
 * across the async execution chain of a handler.
 */
export const contextStorage = new AsyncLocalStorage<Map<string, string>>();

const { combine, timestamp: formatTimestamp, printf, colorize } = winston.format;

const getMemoryUsage = (): string => {
    const memoryUsage = process.memoryUsage();

    return `Mem: ${(memoryUsage.rss / 1024 / 1024).toFixed(2)} MB`;
};

// Logger colors
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
};

winston.addColors(colors);

const colorizer = colorize();

export const formatLogMessage = (info: winston.Logform.TransformableInfo): string => {
    const { level, message, timestamp, ...meta } = info;
    const memory = getMemoryUsage();
    let metaString = "";

    if (Object.keys(meta).length > 0) {
        metaString = ` ${JSON.stringify(meta)}`;
    }

    const store = contextStorage.getStore();
    const requestId = store?.get('requestId');
    const userId = store?.get('userId');

    const reqInfo = requestId ? ` [Req:${requestId}]` : '';
    const userInfo = userId ? ` [User:${userId.substring(0, 8)}...]` : '';

    const coloredLevel = colorizer.colorize(level, level.toUpperCase());
    const pid = `[PID:${process.pid}]`;

    return `[${timestamp}] ${pid} [${coloredLevel}] [${memory}]${reqInfo}${userInfo} ${message}${metaString}`;
};

const customFormat = printf(formatLogMessage);

/**
 * Configured Winston logger instance.
 *
 * Features:
 * - Colorized console output.
 * - Weekly rotating file logs (logs/app-YYYY-WW.log).
 * - Custom format including:
 *   - Timestamp
 *   - Process ID
 *   - Memory usage
 *   - Request ID (if available in context)
 *   - User ID (if available in context)
 *   - Log level and message
 */
export const logger = winston.createLogger({
    level: 'debug',
    format: combine(
        formatTimestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        customFormat
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.DailyRotateFile({
            filename: 'logs/app-%DATE%.log',
            datePattern: 'YYYY-WW', // Weekly rotation
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '4', // 4 Weeks
        })
    ],
});
