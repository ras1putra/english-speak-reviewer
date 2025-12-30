
import { type Context, type MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';

import { logger } from '../utils/logger';

/**
 * Configuration contract for the in-memory rate limiter.
 */
type RateLimitOptions = {
    windowMs: number;
    max: number;
    keyGenerator?: (c: Context) => string;
};

/**
 * Internal counter state per rate limit key.
 */
type HitInfo = {
    count: number;
    resetTime: number;
};

// Cookie storing the client identifier hashed in the UI.
const USER_COOKIE = 'english-speak-reviewer-id';

/**
 * Generates a stable rate limit key prioritizing authenticated identifiers
 * to avoid punishing multiple users behind the same IP.
 */
const defaultKeyGenerator = (c: Context): string => {
    const userHeader = c.req.header('x-user-id');

    if (userHeader) {
        return `user:${userHeader}`;
    }

    const cookieUser = getCookie(c, USER_COOKIE);

    if (cookieUser) {
        return `cookie:${cookieUser}`;
    }

    const cfIp = c.req.header('cf-connecting-ip');

    if (cfIp) {
        return `ip:${cfIp}`;
    }

    const forwardedFor = c.req.header('x-forwarded-for');

    if (forwardedFor) {
        const [first] = forwardedFor.split(',');

        if (first) {
            return `ip:${first.trim()}`;
        }
    }

    const realIp = c.req.header('x-real-ip');

    if (realIp) {
        return `ip:${realIp}`;
    }

    return 'ip:anonymous';
};

/**
 * Returns a middleware enforcing max requests per key within the configured window.
 * Includes the standard `X-RateLimit-*` headers plus `Retry-After` on rejection.
 */
export const createRateLimiter = (options: RateLimitOptions): MiddlewareHandler => {
    const windowMs = Math.max(options.windowMs, 1000);
    const max = Math.max(options.max, 1);
    const keyFn = options.keyGenerator ?? defaultKeyGenerator;
    const hits = new Map<string, HitInfo>();

    return async (c, next) => {
        const key = keyFn(c);

        if (!key) {
            return c.json({ error: 'Too Many Requests' }, 429);
        }

        const now = Date.now();
        let entry = hits.get(key);

        if (!entry || entry.resetTime <= now) {
            entry = {
                count: 0,
                resetTime: now + windowMs,
            };
        }

        entry.count += 1;
        hits.set(key, entry);

        const remaining = Math.max(max - entry.count, 0);
        const resetSeconds = Math.floor(entry.resetTime / 1000);

        c.header('X-RateLimit-Limit', String(max), { append: false });
        c.header('X-RateLimit-Remaining', String(Math.max(remaining, 0)), { append: false });
        c.header('X-RateLimit-Reset', String(resetSeconds), { append: false });

        if (entry.count > max) {
            const retryAfter = Math.max(Math.ceil((entry.resetTime - now) / 1000), 1);

            c.header('Retry-After', String(retryAfter), { append: false });
            logger.warn('Rate limit exceeded', { key, path: c.req.path });

            return c.json({ error: 'Too Many Requests' }, 429);
        }

        await next();

        if (entry.resetTime <= Date.now()) {
            hits.delete(key);
        }
    };
};
