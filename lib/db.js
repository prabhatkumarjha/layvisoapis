/**
 * Database connection utility
 * Centralized Neon PostgreSQL connection
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

export { sql };
