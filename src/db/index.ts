
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schemas';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
}
const client = postgres(connectionString);

/**
 * Drizzle ORM database client.
 * Configured with the Postgres connection string and application schemas.
 */
export const db = drizzle(client, { schema });
