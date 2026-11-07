import pg from 'pg';
import { config } from './config';

export const pool = new pg.Pool({
  connectionString: config.DATABASE_URL,
  max: 10,
  ssl: config.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});
pool.on('error', (e) => console.error('pg pool error', e));

export type Db = pg.Pool | pg.PoolClient;

export const q = <T extends pg.QueryResultRow = any>(text: string, params?: unknown[]) =>
  pool.query<T>(text, params as any[]);

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
