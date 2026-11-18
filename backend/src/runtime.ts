import { createPool } from 'mysql2';
import { attachDatabasePool } from '@vercel/functions/db-connections';
import { createApp } from './application.ts';
import { createGameService } from './game.ts';
import { createPracticeService } from './practice.ts';
import { migratePracticeSkips } from '../database/migrations/020_random_skips.ts';

export async function createRuntime() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Set DATABASE_URL to your MySQL connection URL and import backend/database/schema.sql.');
  let url: URL;
  try { url = new URL(databaseUrl); }
  catch { throw new Error('DATABASE_URL must be a valid MySQL connection URL.'); }
  if (url.protocol !== 'mysql:' || !url.username || !url.pathname.slice(1)) throw new Error('DATABASE_URL must identify a MySQL user and database.');
  const corePool = createPool({ uri: databaseUrl, timezone: 'Z', dateStrings: ['DATE'], connectionLimit: 10 });
  const pool = corePool.promise();
  try {
    if (process.env.VERCEL === '1') attachDatabasePool(corePool);
    await pool.query('SELECT id, score, remaining_seconds FROM game_sessions LIMIT 0');
    const [columns] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
      "SELECT NUMERIC_SCALE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_sessions' AND COLUMN_NAME = 'remaining_seconds'",
    );
    if (Number(columns[0]?.NUMERIC_SCALE) !== 3) throw new Error('Apply backend/database/migrations/001_precise_scoring.sql before starting the API.');
    await migratePracticeSkips(pool);
    return { app: createApp(createGameService(pool), createPracticeService(pool)), pool };
  } catch (error) {
    await pool.end();
    throw error;
  }
}
