import { fileURLToPath } from 'node:url';
import express from 'express';
import { createPool } from 'mysql2/promise';
import { createApp } from './app.ts';
import { createGameService } from './game.ts';
import { createPracticeService } from './practice.ts';

// Prisijungimas ir serverio adresas gaunami iš aplinkos, paslapčių kode nėra.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set DATABASE_URL to your MySQL connection URL and import backend/database/schema.sql.');
let url: URL;
try { url = new URL(databaseUrl); }
catch { throw new Error('DATABASE_URL must be a valid MySQL connection URL.'); }
if (url.protocol !== 'mysql:' || !url.username || !url.pathname.slice(1)) throw new Error('DATABASE_URL must identify a MySQL user and database.');
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
const pool = createPool({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.slice(1)), timezone: 'Z', dateStrings: ['DATE'], connectionLimit: 10 });
await pool.query('SELECT id, score, remaining_seconds FROM game_sessions LIMIT 0');
// Sena sveikų sekundžių schema sustabdoma prieš priimant žaidėjų užklausas.
const [columns] = await pool.query<import('mysql2/promise').RowDataPacket[]>(
  "SELECT NUMERIC_SCALE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'game_sessions' AND COLUMN_NAME = 'remaining_seconds'",
);
if (Number(columns[0]?.NUMERIC_SCALE) !== 3) {
  await pool.end();
  throw new Error('Apply backend/database/migrations/001_precise_scoring.sql before starting the API.');
}
const app = createApp(createGameService(pool), createPracticeService(pool));

// Tas pats serveris gali pateikti ir sukompiliuotą naršyklės sąsają.
const frontend = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
app.use(express.static(frontend));
app.get('/', (_request, response) => response.sendFile('index.html', { root: frontend }));
const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Quintle API listening on port ${port}`));

// Stabdant procesą uždaromos HTTP ir duomenų bazės jungtys.
function shutdown() {
  server.close(() => { void pool.end().then(() => process.exit(0)); });
  server.closeIdleConnections();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
