import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import { createPool } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.ts';
import { createGameService } from '../src/game.ts';
import { GAME_DURATION } from '../../shared/gameRules.mjs';

const databaseUrl = process.env.TEST_DATABASE_URL;

// Šie testai siunčia tikras HTTP užklausas ir tikrina MySQL įrašytą rezultatą.
describe('server and MySQL scoring', { skip: databaseUrl ? false : 'Run npm run test:integration --workspace backend to test MySQL.' }, () => {
  const url = new URL(databaseUrl || 'mysql://unused@localhost/unused');
  const pool = createPool({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), database: url.pathname.slice(1), timezone: 'Z', dateStrings: ['DATE'], connectionLimit: 10 });
  let now = Date.parse('2026-11-17T12:00:00Z');
  let server: Server;
  let base: string;
  const play = createGameService(pool, () => now);

  before(async () => {
    server = createApp(play).listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing HTTP test address.');
    base = `http://127.0.0.1:${address.port}`;
  });
  after(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await pool.end();
  });

  function player() {
    now = Date.parse('2026-11-17T12:00:00Z');
    const token = randomBytes(32).toString('hex');
    return {
      hash: createHash('sha256').update(token).digest(),
      async request(path = '', body?: unknown, headers: Record<string, string> = {}) {
        const response = await fetch(`${base}/api/game${path}`, { method: body === undefined ? 'GET' : 'POST',
          headers: { Cookie: `quintle_player=${token}`, 'Content-Type': 'application/json', ...headers },
          body: body === undefined ? undefined : JSON.stringify(body) });
        return { status: response.status, data: await response.json(), headers: response.headers };
      },
    };
  }
  async function answer(client: ReturnType<typeof player>, value: string) { return client.request('/answers', { answer: value }); }

  it('calculates a precise score through HTTP and stores the same score in MySQL', async () => {
    const client = player();
    assert.equal((await client.request()).data.game.status, 'ready');
    await client.request('/start', {});
    now += 5049;
    let result;
    for (const value of ['Mexico', 'Malta', 'Morocco', 'Mali', 'Monaco']) result = await answer(client, value);
    assert.equal(result!.status, 200);
    assert.equal(result!.data.game.status, 'finished');
    assert.deepEqual(result!.data.game.score, { correctness: 500, speed: 249, total: 749 });
    const [[stored]] = await pool.execute<RowDataPacket[]>(
      'SELECT g.score, g.remaining_seconds FROM game_sessions g JOIN players p ON p.player_id = g.player_id WHERE p.token_hash = ?', [client.hash]);
    assert.equal(stored.score, 749);
    assert.equal(Number(stored.remaining_seconds), 24.951);
  });
  it('does not award points for wrong answers or duplicate aliases', async () => {
    const client = player();
    await client.request('/start', {});
    assert.equal((await answer(client, "Moon' OR 1=1 --")).data.accepted, false);
    assert.equal((await answer(client, 'Burma')).data.accepted, true);
    const duplicate = await answer(client, 'Myanmar');
    assert.equal(duplicate.data.accepted, false);
    assert.deepEqual(duplicate.data.game.answers, ['Myanmar']);
    assert.equal(duplicate.data.game.score.total, 100);
  });
  it('serializes simultaneous aliases without granting duplicate credit', async () => {
    const client = player();
    await client.request('/start', {});
    const replies = await Promise.all([answer(client, 'Burma'), answer(client, 'Myanmar')]);
    assert.equal(replies.filter(reply => reply.data.accepted).length, 1);
    assert.equal((await client.request()).data.game.score.total, 100);
  });
  it('expires at the server deadline and rejects an answer at exactly 30 seconds', async () => {
    const client = player();
    const started = (await client.request('/start', {})).data.game.startedAt;
    for (const value of ['Mexico', 'Malta', 'Morocco', 'Mali']) await answer(client, value);
    now += GAME_DURATION;
    const late = await answer(client, 'Monaco');
    assert.equal(late.data.accepted, false);
    assert.equal(late.data.game.answers.length, 4);
    assert.deepEqual(late.data.game.score, { correctness: 400, speed: 0, total: 400 });
    assert.equal(late.data.game.finishedAt, started + GAME_DURATION);
    assert.equal((await client.request('/start', {})).data.game.status, 'finished');
  });
  it('restores the original start and score after recreating the server service', async () => {
    const client = player();
    const started = (await client.request('/start', {})).data.game.startedAt;
    now += 10_000;
    const again = await client.request('/start', {});
    assert.equal(again.data.game.startedAt, started);
    const restored = await createGameService(pool, () => now)(client.hash, 'read');
    assert.equal(restored.game.startedAt, started);
    assert.equal(restored.game.status, 'playing');
    assert.equal(restored.serverNow - started, 10_000);
  });
  it('never accepts client-provided points, answer counts, or timestamps', async () => {
    const client = player();
    for (const body of [{ score: 800 }, { startedAt: 0 }, { remainingMs: GAME_DURATION }, { correct: 5 }]) {
      assert.equal((await client.request('/start', body)).status, 400);
    }
    await client.request('/start', {});
    assert.equal((await client.request('/answers', { answer: 'Mexico', score: 800 })).status, 400);
    assert.equal((await client.request('/answers', { answer: [] })).status, 400);
    assert.equal((await client.request('/answers', { answer: 'a'.repeat(81) })).status, 400);
    assert.equal((await client.request()).data.game.score.total, 0);
  });
  it('sets a private cookie and rejects foreign origins', async () => {
    const response = await fetch(`${base}/api/game`);
    assert.match(response.headers.get('set-cookie')!, /HttpOnly/i);
    assert.match(response.headers.get('set-cookie')!, /SameSite=Strict/i);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const client = player();
    assert.equal((await client.request('/start', {}, { Origin: 'https://other.example' })).status, 403);
  });
  it('finishes an active UTC challenge across midnight and then unlocks the new date', async () => {
    const client = player();
    now = Date.parse('2026-11-17T23:59:55Z');
    await client.request('/start', {});
    now += 10_000;
    assert.equal((await client.request()).data.game.challenge.date, '2026-11-17');
    for (const value of ['Mexico', 'Malta', 'Morocco', 'Mali', 'Monaco']) await answer(client, value);
    const next = await client.request();
    assert.equal(next.data.game.challenge.date, '2026-11-18');
    assert.equal(next.data.game.status, 'ready');
    assert.equal(next.data.results[0].score, 700);
  });
  it('keeps records when applying the precise-scoring migration', async () => {
    // Migracija turi tikti ir jau veikiančiai bazei, ne tik naujai schemai.
    const [before] = await pool.query<RowDataPacket[]>('SELECT session_id, score FROM game_sessions ORDER BY session_id');
    const migration = await readFile(new URL('../database/migrations/001_precise_scoring.sql', import.meta.url), 'utf8');
    const oldDefinition = migration.replace('DECIMAL(5,3)', 'TINYINT').replace(' / 1000000', ' DIV 1000000')
      .replace('FLOOR(100 * correct_count + 10 * remaining_seconds)', '100 * correct_count + 10 * remaining_seconds');
    await pool.query(oldDefinition);
    const [[rounded]] = await pool.query<RowDataPacket[]>('SELECT score FROM game_sessions WHERE session_id = ?', [before[0].session_id]);
    assert.equal(rounded.score, 750);
    await pool.query(migration);
    const [after] = await pool.query<RowDataPacket[]>('SELECT session_id, score FROM game_sessions ORDER BY session_id');
    assert.deepEqual(after, before);
  });
  it('adds challenge metadata to an existing database without losing content', async () => {
    const [before] = await pool.query<RowDataPacket[]>('SELECT challenge_date, category, prompt FROM daily_challenges ORDER BY challenge_date');
    await pool.query(`ALTER TABLE daily_challenges
      DROP CHECK ck_challenge_time_limit, DROP CHECK ck_challenge_required_answers, DROP CHECK ck_challenge_active,
      DROP COLUMN time_limit, DROP COLUMN required_answers, DROP COLUMN is_active,
      DROP COLUMN created_at, DROP COLUMN updated_at`);
    await pool.query(await readFile(new URL('../database/migrations/002_challenge_metadata.sql', import.meta.url), 'utf8'));
    const [after] = await pool.query<RowDataPacket[]>('SELECT challenge_date, category, prompt FROM daily_challenges ORDER BY challenge_date');
    assert.deepEqual(after, before);
    const [metadata] = await pool.query<RowDataPacket[]>('SELECT time_limit, required_answers, is_active, created_at, updated_at FROM daily_challenges');
    assert.ok(metadata.length > 0);
    for (const row of metadata) {
      assert.equal(row.time_limit, 30);
      assert.equal(row.required_answers, 5);
      assert.equal(row.is_active, 1);
      assert.ok(Number.isFinite(row.created_at.getTime()));
      assert.ok(Number.isFinite(row.updated_at.getTime()));
    }
    for (const column of ['time_limit', 'required_answers', 'is_active']) {
      const invalid = column === 'is_active' ? 2 : 0;
      await assert.rejects(pool.query(`UPDATE daily_challenges SET ${column} = ${invalid}`), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
    }
    const date = before[0].challenge_date;
    await pool.execute("UPDATE daily_challenges SET updated_at = '2000-01-01 00:00:00' WHERE challenge_date = ?", [date]);
    await pool.execute('UPDATE daily_challenges SET time_limit = 45 WHERE challenge_date = ?', [date]);
    const [[changed]] = await pool.query<RowDataPacket[]>('SELECT updated_at FROM daily_challenges WHERE challenge_date = ?', [date]);
    assert.ok(changed.updated_at.getTime() > Date.parse('2000-01-01T00:00:00Z'));
    await pool.execute('UPDATE daily_challenges SET time_limit = 30 WHERE challenge_date = ?', [date]);
  });
});
