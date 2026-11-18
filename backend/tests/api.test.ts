import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { after, afterEach, beforeEach, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import type { Server } from 'node:http';
import { createPool } from 'mysql2/promise';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.ts';
import { createGameService } from '../src/game.ts';
import { createPracticeService } from '../src/practice.ts';
import { GAME_DURATION } from '../../shared/gameRules.mjs';
import { getDailyChallenge } from '../../shared/challenges.mjs';
import { getPracticeChallenge } from '../../shared/practiceChallenges.mjs';
import { migrateSubmissionDetails } from '../database/migrations/010_submission_details.ts';
import { migratePracticeSkips } from '../database/migrations/020_random_skips.ts';

const databaseUrl = process.env.TEST_DATABASE_URL;

// Šie testai siunčia tikras HTTP užklausas ir tikrina MySQL įrašytą rezultatą.
describe('server and MySQL scoring', { skip: databaseUrl ? false : 'Run npm run test:integration --workspace backend to test MySQL.' }, () => {
  const url = new URL(databaseUrl || 'mysql://unused@localhost/unused');
  const pool = createPool({ host: url.hostname, port: Number(url.port || 3306), user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password), database: url.pathname.slice(1), timezone: 'Z', dateStrings: ['DATE'], connectionLimit: 10 });
  pool.on('connection', connection => connection.query("SET time_zone = '+00:00'"));
  let now = Date.parse('2026-11-17T12:00:00Z');
  let server: Server;
  let base: string;
  const play = createGameService(pool, () => now);

  // Each test gets its own HTTP rate-limit window while retaining migration fixtures.
  beforeEach(async () => {
    server = createApp(play, createPracticeService(pool, () => now)).listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Missing HTTP test address.');
    base = `http://127.0.0.1:${address.port}`;
  });
  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  });
  after(async () => { await pool.end(); });

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
  async function migrateSessionStatuses(legacy = false, connection: Pick<typeof pool, 'query'> = pool) {
    const migration = await readFile(new URL('../database/migrations/017_session_statuses.sql', import.meta.url), 'utf8');
    const labels: Record<string, string> = { active: 'in_progress', completed: 'solved', expired: 'timed_out',
      in_progress: 'active', solved: 'completed', timed_out: 'expired' };
    const sql = legacy ? migration.replace(/'(active|completed|expired|in_progress|solved|timed_out)'/g,
      (_match, status: string) => `'${labels[status]}'`) : migration;
    for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await connection.query(statement);
  }
  async function renameSessionTimestamps(legacy = false, connection: Pick<typeof pool, 'query'> = pool) {
    if (legacy) await migrateSessionStatuses(true, connection);
    const migration = await readFile(new URL('../database/migrations/016_session_timestamps.sql', import.meta.url), 'utf8');
    const sql = legacy ? migration.replace(/\b(started_at|finished_at)\b/g, '$1_utc')
      .replace('RENAME COLUMN started_at_utc TO started_at_utc', 'RENAME COLUMN started_at TO started_at_utc')
      .replace('RENAME COLUMN finished_at_utc TO finished_at_utc', 'RENAME COLUMN finished_at TO finished_at_utc') : migration;
    for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await connection.query(statement);
    if (!legacy) await migrateSessionStatuses(false, connection);
  }
  async function renameSessionAnswerCount(legacy = false, connection: Pick<typeof pool, 'query'> = pool) {
    if (legacy) await renameSessionTimestamps(true, connection);
    const migration = await readFile(new URL('../database/migrations/015_session_answer_count.sql', import.meta.url), 'utf8');
    const sql = legacy ? migration.replaceAll('correct_answers', 'correct_count')
      .replace('RENAME COLUMN correct_count TO correct_count', 'RENAME COLUMN correct_answers TO correct_count') : migration;
    for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await connection.query(statement);
    if (!legacy) await renameSessionTimestamps(false, connection);
  }
  async function renameSessionIdentity(legacy = false, connection: Pick<typeof pool, 'query'> = pool) {
    if (legacy) await renameSessionAnswerCount(true, connection);
    const migration = await readFile(new URL('../database/migrations/014_session_identity_field.sql', import.meta.url), 'utf8');
    const sql = legacy ? migration.replace('RENAME COLUMN session_id TO id', 'RENAME COLUMN id TO session_id')
      .replace('SELECT id AS session_id', 'SELECT session_id')
      .replace('REFERENCES game_sessions (id, challenge_date)', 'REFERENCES game_sessions (session_id, challenge_date)') : migration;
    for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await connection.query(statement);
    if (!legacy) await renameSessionAnswerCount(false, connection);
  }
  async function migrateSubmissionIdentity(connection: Pick<typeof pool, 'query'> = pool) {
    const migration = await readFile(new URL('../database/migrations/013_submission_identity_fields.sql', import.meta.url), 'utf8');
    for (const statement of migration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await connection.query(statement);
  }
  async function restoreLegacySubmissionIdentity(connection: Pick<typeof pool, 'query'> = pool) {
    await connection.query(`ALTER TABLE player_submissions
      DROP CHECK ck_submission_answer, DROP INDEX uq_submission_credit, DROP COLUMN credited_answer_id`);
    await connection.query(`ALTER TABLE player_submissions RENAME COLUMN id TO submission_id, RENAME COLUMN result TO outcome`);
    await connection.query(`ALTER TABLE player_submissions
      ADD COLUMN credited_answer_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN outcome = 'correct' THEN answer_id END) STORED,
      ADD UNIQUE KEY uq_submission_credit (session_id, credited_answer_id),
      ADD CONSTRAINT ck_submission_answer CHECK ((outcome IN ('incorrect', 'expired') AND answer_id IS NULL)
        OR (outcome IN ('correct', 'duplicate') AND answer_id IS NOT NULL))`);
  }
  async function removeSessionChallengeIds() {
    await pool.query('ALTER TABLE game_sessions DROP FOREIGN KEY fk_session_challenge_id');
    await pool.query(`ALTER TABLE game_sessions DROP INDEX uq_session_player_challenge,
      DROP INDEX ix_session_challenge_score, DROP INDEX fk_session_challenge_id, DROP COLUMN challenge_id`);
  }

  it('starts the actual server against the current schema', async () => {
    const reservation = createServer().listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const address = reservation.address();
    assert.ok(address && typeof address === 'object');
    const port = address.port;
    await new Promise<void>(resolve => reservation.close(() => resolve()));
    const child = spawn(process.execPath, [fileURLToPath(new URL('../src/server.ts', import.meta.url))], {
      windowsHide: true, env: { ...process.env, DATABASE_URL: databaseUrl, PORT: String(port), HOST: '127.0.0.1' },
    });
    const closed = new Promise<void>(resolve => child.once('close', () => resolve()));
    let output = '';
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Startup timed out: ${output}`)), 10_000);
        const fail = (error: Error) => { clearTimeout(timer); reject(error); };
        child.once('error', fail);
        child.once('exit', code => fail(new Error(`Startup exited ${code}: ${output}`)));
        child.stderr.on('data', chunk => { output += chunk; });
        child.stdout.on('data', chunk => {
          output += chunk;
          if (output.includes('Quintle API listening')) { clearTimeout(timer); resolve(); }
        });
      });
      const response = await fetch(`http://127.0.0.1:${port}/api/game`, { signal: AbortSignal.timeout(5000) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).game.challenge.date, new Date().toISOString().slice(0, 10));
    } finally {
      child.kill();
      await closed;
    }
  });
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
      'SELECT g.score, g.remaining_seconds, g.status FROM game_sessions g JOIN players p ON p.id = g.player_id WHERE p.token_hash = ?', [client.hash]);
    assert.equal(stored.score, 749);
    assert.equal(stored.status, 'completed');
    assert.equal(Number(stored.remaining_seconds), 24.951);
    assert.equal((await answer(client, 'Burma')).data.accepted, false);
    const [[solved]] = await pool.execute<RowDataPacket[]>(`SELECT g.total_submissions FROM game_sessions g
      JOIN players p ON p.id = g.player_id WHERE p.token_hash = ?`, [client.hash]);
    assert.equal(solved.total_submissions, 5);
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
  it('migrates submission IDs and results while preserving history, scores, and rarity', async () => {
    const snapshot = async () => Promise.all([['player_submissions', 'id'], ['game_sessions', 'id'],
      ['players', 'id'], ['answer_rarity_stats', 'answer_id']].map(async ([table, key]) => (await pool.query(`SELECT * FROM ${table} ORDER BY ${key}`))[0]));
    const before = await snapshot();
    await restoreLegacySubmissionIdentity();
    await pool.query('ALTER TABLE player_submissions DROP CHECK ck_submission_answer');
    await pool.query(`ALTER TABLE player_submissions MODIFY COLUMN outcome ENUM('correct', 'duplicate', 'incorrect') NOT NULL,
      ADD CONSTRAINT ck_submission_answer CHECK ((outcome = 'incorrect' AND answer_id IS NULL)
        OR (outcome IN ('correct', 'duplicate') AND answer_id IS NOT NULL))`);
    const migration = await readFile(new URL('../database/migrations/011_expired_submissions.sql', import.meta.url), 'utf8');
    for (const statement of migration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await pool.query(statement);
    await migrateSubmissionIdentity();
    assert.deepEqual(await snapshot(), before);
    const [index] = await pool.query<RowDataPacket[]>("SHOW INDEX FROM player_submissions WHERE Key_name = 'ix_submission_answer_result'");
    assert.deepEqual(index.map(column => column.Column_name), ['answer_id', 'result']);
    const [[column]] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM player_submissions WHERE Field = 'id'");
    assert.equal(column.Extra, 'auto_increment');
  });
  it('expires at the server deadline and records late guesses without credit', async () => {
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
    now += 1234;
    for (const value of ['Burma', 'Moon']) {
      const retry = await answer(client, value);
      assert.equal(retry.data.accepted, false);
      assert.deepEqual(retry.data.game, late.data.game);
    }
    await client.request();
    const [[stored]] = await pool.execute<RowDataPacket[]>(`SELECT g.*, p.total_games, p.total_score, p.last_played_at
      FROM game_sessions g JOIN players p ON p.id = g.player_id WHERE p.token_hash = ?`, [client.hash]);
    assert.deepEqual([stored.total_submissions, stored.correct_answers, stored.score, stored.total_games, stored.total_score], [7, 4, 400, 1, 400]);
    assert.equal(stored.status, 'expired');
    assert.equal(stored.last_played_at.getTime(), now);
    const [expired] = await pool.execute<RowDataPacket[]>(`SELECT submitted_text, normalized_text, response_time_ms, answer_id, credited_answer_id
      FROM player_submissions WHERE session_id = ? AND result = 'expired' ORDER BY id`, [stored.id]);
    assert.deepEqual(expired.map(row => Object.values(row)), [
      ['Monaco', 'monaco', 30000, null, null], ['Burma', 'burma', 31234, null, null], ['Moon', 'moon', 31234, null, null],
    ]);
    await assert.rejects(pool.execute(`UPDATE player_submissions SET answer_id =
      (SELECT id FROM accepted_answers WHERE challenge_date = ? LIMIT 1) WHERE session_id = ? AND result = 'expired'`,
    [stored.challenge_date, stored.id]), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
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
  it('starts today on the first click after an unattended attempt expires across midnight', async () => {
    const client = player();
    now = Date.parse('2026-11-17T23:59:55Z');
    const previous = (await client.request('/start', {})).data.game;
    await answer(client, 'Mexico');
    now = previous.startedAt + GAME_DURATION;
    const next = await client.request('/start', {});
    assert.equal(next.status, 200);
    assert.equal(next.data.game.challenge.date, '2026-11-18');
    assert.equal(next.data.game.status, 'playing');
    assert.equal(next.data.game.startedAt, now);
    assert.deepEqual(next.data.game.answers, []);
    assert.deepEqual(next.data.results, [{ date: '2026-11-17', correct: 1, score: 100 }]);
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT g.challenge_date, g.status, g.finished_at FROM game_sessions g
      JOIN players p ON p.id = g.player_id WHERE p.token_hash = ? ORDER BY g.challenge_date`, [client.hash]);
    assert.deepEqual(rows.map(row => [row.challenge_date, row.status]), [['2026-11-17', 'expired'], ['2026-11-18', 'active']]);
    assert.equal(rows[0].finished_at.getTime(), previous.startedAt + GAME_DURATION);
    const startedAt = now;
    now += 1234;
    assert.equal((await client.request('/start', {})).data.game.startedAt, startedAt);
  });
  it('keeps a live midnight attempt on repeated starts and rejects late answers for its original day', async () => {
    const client = player();
    now = Date.parse('2026-11-17T23:59:55Z');
    const previous = (await client.request('/start', {})).data.game;
    now += 10_000;
    const resumed = await client.request('/start', {});
    assert.deepEqual(resumed.data.game, previous);
    now = previous.startedAt + GAME_DURATION;
    const late = await answer(client, 'Mexico');
    assert.equal(late.data.accepted, false);
    assert.equal(late.data.game.challenge.date, '2026-11-17');
    assert.equal(late.data.game.status, 'finished');
    assert.equal(late.data.game.score.total, 0);
    assert.equal((await client.request('/start', {})).data.game.challenge.date, '2026-11-18');
  });
  it('shares one daily challenge across concurrent players and preserves database content', async () => {
    const clients = Array.from({ length: 4 }, player);
    now = Date.parse('2026-12-24T23:59:59.999Z');
    const replies = await Promise.all(clients.map(client => client.request()));
    for (const reply of replies) {
      assert.equal(reply.status, 200);
      assert.equal(reply.data.game.status, 'ready');
      assert.deepEqual(reply.data.game.challenge, replies[0].data.game.challenge);
      assert.equal(Object.hasOwn(reply.data.game.challenge, 'answers'), false);
    }
    now += 1;
    const next = await clients[0].request();
    assert.equal(next.data.game.challenge.date, '2026-12-25');
    assert.equal(next.data.game.challenge.number, replies[0].data.game.challenge.number + 1);
    assert.notEqual(next.data.game.challenge.prompt, replies[0].data.game.challenge.prompt);
    const [[original]] = await pool.execute<RowDataPacket[]>('SELECT * FROM daily_challenges WHERE challenge_date = ?', [next.data.game.challenge.date]);
    const custom = { category: 'Curated category', prompt: 'A question maintained in the database' };
    try {
      await pool.execute('UPDATE daily_challenges SET category = ?, prompt = ? WHERE id = ?', [custom.category, custom.prompt, original.id]);
      const updated = await Promise.all(clients.map(client => client.request()));
      for (const reply of updated) {
        assert.equal(reply.status, 200);
        assert.deepEqual(reply.data.game.challenge, { ...next.data.game.challenge, ...custom });
      }
      const [[count]] = await pool.execute<RowDataPacket[]>('SELECT COUNT(*) AS total FROM daily_challenges WHERE challenge_date = ?', [next.data.game.challenge.date]);
      assert.equal(count.total, 1);
    } finally {
      await pool.execute('UPDATE daily_challenges SET category = ?, prompt = ? WHERE id = ?', [original.category, original.prompt, original.id]);
    }
  });
  it('does not start a daily challenge with fewer than the required reachable answers', async () => {
    const client = player();
    now = Date.parse('2027-01-01T12:00:00Z');
    const [challenge] = await pool.execute<ResultSetHeader>(
      'INSERT INTO daily_challenges (challenge_date, category, prompt) VALUES (?, ?, ?)',
      [new Date(now).toISOString().slice(0, 10), 'Curated category', 'Name five curated answers']);
    const [[source]] = await pool.query<RowDataPacket[]>(`SELECT challenge_id FROM accepted_answers
      GROUP BY challenge_id HAVING COUNT(*) >= 5 ORDER BY challenge_id LIMIT 1`);
    const [answers] = await pool.execute<RowDataPacket[]>(`SELECT answer FROM accepted_answers
      WHERE challenge_id = ? ORDER BY id LIMIT 5`, [source.challenge_id]);
    for (const { answer } of answers) {
      await pool.execute('INSERT INTO accepted_answers (challenge_id, challenge_date, answer) VALUES (?, ?, ?)',
        [challenge.insertId, new Date(now).toISOString().slice(0, 10), answer]);
    }
    // Multiple aliases for one answer cannot make an incomplete challenge playable.
    const [keys] = await pool.execute<RowDataPacket[]>('SELECT id, challenge_date FROM accepted_answers WHERE challenge_id = ? ORDER BY id', [challenge.insertId]);
    for (const key of ['first', 'second', 'third', 'fourth', 'fifth']) {
      await pool.execute('INSERT INTO answer_keys (challenge_date, normalized_key, answer_id) VALUES (?, ?, ?)', [keys[0].challenge_date, key, keys[0].id]);
    }
    for (const path of ['', '/start']) {
      const response = await client.request(path, path ? {} : undefined);
      assert.equal(response.status, 200);
      assert.equal(response.data.game.status, 'unavailable');
      assert.equal(response.data.game.startedAt, null);
    }
    await pool.execute(`INSERT INTO answer_keys (challenge_date, normalized_key, answer_id)
      SELECT challenge_date, LOWER(answer), id FROM accepted_answers WHERE challenge_id = ?`, [challenge.insertId]);
    assert.equal((await client.request('/start', {})).data.game.status, 'playing');
  });
  it('keeps records when applying the precise-scoring migration', async () => {
    // Migracija turi tikti ir jau veikiančiai bazei, ne tik naujai schemai.
    const [before] = await pool.query<RowDataPacket[]>('SELECT id, score FROM game_sessions ORDER BY id');
    await renameSessionAnswerCount(true);
    const migration = await readFile(new URL('../database/migrations/001_precise_scoring.sql', import.meta.url), 'utf8');
    await pool.query('ALTER TABLE game_sessions DROP INDEX ix_session_challenge_score');
    const oldDefinition = migration.replace('DECIMAL(5,3)', 'TINYINT').replace(' / 1000000', ' DIV 1000000')
      .replace('FLOOR(100 * correct_count + 10 * remaining_seconds)', '100 * correct_count + 10 * remaining_seconds');
    await pool.query(oldDefinition);
    const [[rounded]] = await pool.query<RowDataPacket[]>('SELECT score FROM game_sessions WHERE id = ?', [before.find(row => row.score === 749)!.id]);
    assert.equal(rounded.score, 750);
    await pool.query(migration);
    await pool.query('ALTER TABLE game_sessions ADD INDEX ix_session_challenge_score (challenge_id, score DESC)');
    await renameSessionAnswerCount();
    const [after] = await pool.query<RowDataPacket[]>('SELECT id, score FROM game_sessions ORDER BY id');
    assert.deepEqual(after, before);
  });
  it('migrates session fields and statuses while preserving history and score views', async () => {
    const snapshot = async () => Promise.all([['game_sessions', 'id'], ['player_submissions', 'id'], ['player_scores', 'session_id'],
      ['daily_leaderboard', 'challenge_date, player_id'], ['player_streaks', 'player_id'], ['answer_rarity_stats', 'answer_id']]
      .map(async ([table, order]) => (await pool.query(`SELECT * FROM ${table} ORDER BY ${order}`))[0]));
    const before = await snapshot();
    await renameSessionAnswerCount(true);
    const labels: Record<string, string> = { active: 'in_progress', completed: 'solved', expired: 'timed_out' };
    const [legacy] = await pool.query('SELECT id, status FROM game_sessions ORDER BY id');
    assert.deepEqual(legacy, (before[0] as RowDataPacket[]).map(row => ({ id: row.id, status: labels[row.status] })));
    await renameSessionAnswerCount();
    assert.deepEqual(await snapshot(), before);
    const [[column]] = await pool.query<RowDataPacket[]>("SHOW COLUMNS FROM game_sessions WHERE Field = 'status'");
    assert.equal(column.Type, "enum('active','completed','expired')");
    assert.equal(column.Default, 'active');
    for (const [status, count] of [['active', 5], ['completed', 4], ['expired', 5]]) {
      await assert.rejects(pool.execute('UPDATE game_sessions SET correct_answers = ? WHERE status = ?', [count, status]),
        { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
    }
    for (const update of ["started_at = started_at - INTERVAL 1 DAY WHERE status = 'active'",
      "finished_at = started_at + INTERVAL 30 SECOND WHERE status = 'completed'",
      "finished_at = started_at + INTERVAL 29 SECOND WHERE status = 'expired'"]) {
      await assert.rejects(pool.query(`UPDATE game_sessions SET ${update}`), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
    }
    const [indexes] = await pool.query<RowDataPacket[]>("SHOW INDEX FROM game_sessions WHERE Key_name IN ('ix_session_daily_score', 'ix_session_challenge_score')");
    for (const [name, key] of [['ix_session_daily_score', 'challenge_date'], ['ix_session_challenge_score', 'challenge_id']]) {
      const columns = indexes.filter(index => index.Key_name === name);
      assert.deepEqual(columns.map(column => column.Column_name), [key, 'score']);
      assert.equal(columns[1].Collation, 'D');
    }
  });
  it('migrates challenge and answer fields without losing answers, aliases, sessions, or scores', async () => {
    const snapshot = async () => Promise.all(['daily_challenges', 'accepted_answers', 'answer_keys', 'game_sessions', 'player_submissions'].map(async table => {
      const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${table}`);
      return rows.map(({ id, challenge_id, created_at, updated_at, ...row }) => table === 'accepted_answers' ? { id, ...row } : row)
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }));
    const before = await snapshot();
    await removeSessionChallengeIds();
    await pool.query(`ALTER TABLE answer_keys DROP PRIMARY KEY, DROP INDEX uq_key_challenge, DROP INDEX uq_key_answer,
      DROP COLUMN id, DROP COLUMN created_at,
      CHANGE COLUMN normalized_key normalized_answer VARCHAR(191) COLLATE utf8mb4_0900_bin NOT NULL,
      ADD PRIMARY KEY (challenge_date, normalized_answer)`);
    await pool.query('ALTER TABLE accepted_answers RENAME COLUMN id TO answer_id, ALGORITHM = INPLACE');
    await pool.query('ALTER TABLE accepted_answers CHANGE COLUMN answer display_answer VARCHAR(191) NOT NULL');
    await pool.query('ALTER TABLE accepted_answers DROP FOREIGN KEY fk_answer_challenge');
    await pool.query(`ALTER TABLE accepted_answers
      DROP INDEX uq_answer_display,
      DROP COLUMN challenge_id, DROP COLUMN created_at,
      ADD UNIQUE KEY uq_answer_display (challenge_date, display_answer),
      ADD CONSTRAINT fk_answer_challenge FOREIGN KEY (challenge_date) REFERENCES daily_challenges (challenge_date)`);
    await pool.query(`ALTER TABLE daily_challenges
      DROP PRIMARY KEY, DROP INDEX uq_challenge_id_date, DROP COLUMN id, ADD PRIMARY KEY (challenge_date)`);
    await pool.query('ALTER TABLE daily_challenges DROP INDEX uq_challenge_date');
    const migration = await readFile(new URL('../database/migrations/003_challenge_ids.sql', import.meta.url), 'utf8');
    for (const statement of migration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await pool.query(statement);
    const answerMigration = await readFile(new URL('../database/migrations/004_answer_fields.sql', import.meta.url), 'utf8');
    await restoreLegacySubmissionIdentity();
    for (const statement of answerMigration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await pool.query(statement);
    await migrateSubmissionIdentity();
    const sessionMigration = await readFile(new URL('../database/migrations/009_session_challenges.sql', import.meta.url), 'utf8');
    for (const statement of sessionMigration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await pool.query(statement);
    assert.deepEqual(await snapshot(), before);
    const [links] = await pool.query<RowDataPacket[]>(`SELECT a.id AS answer_id, a.challenge_id, c.id, a.created_at
      FROM accepted_answers a JOIN daily_challenges c ON c.challenge_date = a.challenge_date`);
    assert.ok(links.length > 0);
    for (const link of links) {
      assert.equal(link.challenge_id, link.id);
      assert.ok(Number.isFinite(link.created_at.getTime()));
    }
    const other = links.find(link => link.id !== links[0].id)!;
    assert.ok(other);
    await assert.rejects(pool.execute('UPDATE accepted_answers SET challenge_id = ? WHERE id = ?',
      [other.id, links[0].answer_id]), { code: 'ER_NO_REFERENCED_ROW_2' });
    const [keys] = await pool.query<RowDataPacket[]>('SELECT * FROM answer_keys');
    assert.equal(new Set(keys.map(key => key.id)).size, keys.length);
    for (const key of keys) assert.ok(Number.isFinite(key.created_at.getTime()));
    const key = keys.find(key => key.answer_id === links[0].answer_id)!;
    const otherAnswer = links.find(link => link.id === links[0].id && link.answer_id !== key.answer_id)!;
    for (const answerId of [key.answer_id, otherAnswer.answer_id]) {
      await assert.rejects(pool.execute('INSERT INTO answer_keys (challenge_date, normalized_key, answer_id) VALUES (?, ?, ?)',
        [key.challenge_date, key.normalized_key, answerId]), { code: 'ER_DUP_ENTRY' });
    }
    const [[stats]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM answer_rarity_stats');
    assert.equal(stats.count, links.length);
    const longText = 'a'.repeat(255);
    const [longAnswer] = await pool.execute<ResultSetHeader>(
      'INSERT INTO accepted_answers (challenge_id, challenge_date, answer) VALUES (?, ?, ?)',
      [links[0].id, key.challenge_date, longText]);
    await pool.execute('INSERT INTO answer_keys (challenge_date, normalized_key, answer_id) VALUES (?, ?, ?)',
      [key.challenge_date, longText, longAnswer.insertId]);
    const client = player();
    await client.request('/start', {});
    assert.equal((await answer(client, 'Burma')).data.accepted, true);
  });
  it('migrates player UUIDs while retaining cookies, sessions, scores, and streaks', async () => {
    const client = player();
    await client.request('/start', {});
    await answer(client, 'Mexico');
    const original = (await client.request()).data;
    const snapshot = async () => (await pool.query<RowDataPacket[]>(`SELECT HEX(p.token_hash) AS token, p.created_at,
      g.id, g.challenge_date, g.started_at, g.finished_at, g.status, g.correct_answers, g.remaining_seconds, g.score,
      s.current_streak, s.longest_streak, s.last_played_date
      FROM players p LEFT JOIN game_sessions g ON g.player_id = p.id
      LEFT JOIN player_streaks s ON s.player_id = p.id ORDER BY token, g.id`))[0];
    const before = await snapshot();
    await pool.query('ALTER TABLE game_sessions DROP INDEX uq_session_player_challenge');
    await pool.query('ALTER TABLE players ADD COLUMN player_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD UNIQUE KEY uq_legacy_player (player_id)');
    await pool.query('ALTER TABLE game_sessions ADD COLUMN legacy_player_id BIGINT UNSIGNED NULL');
    await pool.query('UPDATE game_sessions g JOIN players p ON p.id = g.player_id SET g.legacy_player_id = p.player_id');
    await pool.query('ALTER TABLE game_sessions DROP FOREIGN KEY fk_session_player');
    await pool.query('ALTER TABLE practice_sessions DROP FOREIGN KEY fk_practice_player');
    await pool.query(`ALTER TABLE game_sessions DROP INDEX uq_session_player_day, DROP COLUMN player_id,
      CHANGE COLUMN legacy_player_id player_id BIGINT UNSIGNED NOT NULL,
      ADD UNIQUE KEY uq_session_player_day (player_id, challenge_date)`);
    await pool.query('ALTER TABLE players DROP PRIMARY KEY, DROP COLUMN id, ADD PRIMARY KEY (player_id), DROP INDEX uq_legacy_player');
    await pool.query('ALTER TABLE game_sessions ADD CONSTRAINT fk_session_player FOREIGN KEY (player_id) REFERENCES players (player_id)');
    const migration = await readFile(new URL('../database/migrations/005_player_uuids.sql', import.meta.url), 'utf8');
    for (const statement of migration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await pool.query(statement);
    await pool.query('ALTER TABLE game_sessions ADD UNIQUE KEY uq_session_player_challenge (player_id, challenge_id)');
    await pool.query('ALTER TABLE practice_sessions ADD CONSTRAINT fk_practice_player FOREIGN KEY (player_id) REFERENCES players (id)');
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual((await client.request()).data, original);
    const [players] = await pool.query<RowDataPacket[]>('SELECT id FROM players');
    for (const player of players) assert.match(player.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const [[streaks]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM player_streaks');
    assert.equal(streaks.count, players.length);
    await assert.rejects(pool.query(`INSERT INTO game_sessions (id, player_id, challenge_id, challenge_date, started_at)
      SELECT '00000000-0000-4000-8000-000000000000', player_id, challenge_id, challenge_date, started_at FROM game_sessions LIMIT 1`), { code: 'ER_DUP_ENTRY' });
    await assert.rejects(pool.execute('UPDATE game_sessions SET player_id = ? WHERE id = ?',
      ['00000000-0000-4000-8000-000000000000', before.find(row => row.id)!.id]), { code: 'ER_NO_REFERENCED_ROW_2' });
  });
  it('migrates session UUIDs without losing guesses, scores, or the original deadline', async () => {
    const client = player();
    await client.request('/start', {});
    now += 1234;
    await answer(client, 'Mexico');
    const original = (await client.request()).data;
    const snapshot = async () => {
      const [games] = await pool.query<RowDataPacket[]>('SELECT * FROM game_sessions ORDER BY player_id, challenge_date');
      const [guesses] = await pool.query<RowDataPacket[]>(`SELECT s.*, g.player_id FROM player_submissions s
        JOIN game_sessions g ON g.id = s.session_id ORDER BY s.id`);
      return [games.map(({ id, ...row }) => row), guesses.map(({ session_id, ...row }) => row)];
    };
    const before = await snapshot();
    const connection = await pool.getConnection();
    try {
      await renameSessionAnswerCount(true, connection);
      await connection.query('ALTER TABLE game_sessions ADD COLUMN legacy_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD UNIQUE KEY uq_legacy_session (legacy_id)');
      await connection.query('ALTER TABLE player_submissions DROP FOREIGN KEY fk_submission_session');
      await connection.query('UPDATE player_submissions s JOIN game_sessions g ON g.id = s.session_id SET s.session_id = g.legacy_id');
      await connection.query('ALTER TABLE player_submissions MODIFY COLUMN session_id BIGINT UNSIGNED NOT NULL');
      await connection.query(`ALTER TABLE game_sessions DROP INDEX uq_session_id_day, DROP PRIMARY KEY, DROP COLUMN id,
        CHANGE COLUMN legacy_id session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD PRIMARY KEY (session_id),
        DROP INDEX uq_legacy_session, ADD UNIQUE KEY uq_session_id_day (session_id, challenge_date)`);
      await connection.query(`ALTER TABLE player_submissions ADD CONSTRAINT fk_submission_session
        FOREIGN KEY (session_id, challenge_date) REFERENCES game_sessions (session_id, challenge_date)`);
      const migration = await readFile(new URL('../database/migrations/007_session_uuids.sql', import.meta.url), 'utf8');
      for (const statement of migration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await connection.query(statement);
      await renameSessionIdentity(false, connection);
    } finally { connection.release(); }
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual((await client.request()).data, original);
    const [sessions] = await pool.query<RowDataPacket[]>('SELECT id FROM game_sessions');
    for (const session of sessions) assert.match(session.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    await assert.rejects(pool.execute('UPDATE player_submissions SET session_id = ? WHERE id = ?',
      ['00000000-0000-4000-8000-000000000000', before[1][0].id]), { code: 'ER_NO_REFERENCED_ROW_2' });
    assert.equal((await answer(client, 'Mexico')).data.accepted, false);
    assert.equal((await answer(client, 'Burma')).data.accepted, true);
  });
  it('tracks player statistics across gaps and restores them from existing history', async () => {
    const client = player();
    const firstDay = Date.parse(new Date().toISOString().slice(0, 10)) - 4 * 86_400_000 + 43_200_000;
    const profile = async () => (await pool.execute<RowDataPacket[]>('SELECT * FROM players WHERE token_hash = ?', [client.hash]))[0][0];
    const totals = async () => { const p = await profile(); return [p.current_streak, p.longest_streak, p.total_games, p.total_score]; };
    now = firstDay;
    await client.request();
    assert.equal((await profile()).display_name, null);
    assert.equal((await profile()).last_played_at, null);
    assert.deepEqual(await totals(), [0, 0, 0, 0]);
    await client.request('/start', {});
    now += 5049;
    for (const variants of getDailyChallenge(now).answers.slice(0, 5)) await answer(client, variants[0]);
    assert.deepEqual(await totals(), [1, 1, 1, 749]);
    now = firstDay + 86_400_000;
    await client.request('/start', {});
    now += GAME_DURATION;
    await client.request();
    assert.deepEqual(await totals(), [2, 2, 2, 749]);
    now = firstDay + 3 * 86_400_000;
    await client.request();
    assert.deepEqual(await totals(), [0, 2, 2, 749]);
    const idle = await profile();
    await client.request();
    assert.deepEqual(await profile(), idle);
    now = firstDay + 4 * 86_400_000;
    await client.request('/start', {});
    assert.deepEqual(await totals(), [0, 2, 2, 749]);
    now += GAME_DURATION;
    await client.request();
    assert.deepEqual(await totals(), [1, 2, 3, 749]);
    const connection = await pool.getConnection();
    try {
      await connection.query("SET time_zone = '+00:00'");
      const [before] = await connection.query('SELECT * FROM players ORDER BY id');
      await connection.query(`ALTER TABLE players CHANGE COLUMN created_at created_at_utc DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
        DROP COLUMN display_name, DROP COLUMN last_played_at, DROP COLUMN current_streak, DROP COLUMN longest_streak,
        DROP COLUMN last_completed_date, DROP COLUMN total_games, DROP COLUMN total_score`);
      await connection.query("SET time_zone = '+05:30'");
      const migration = await readFile(new URL('../database/migrations/006_player_statistics.sql', import.meta.url), 'utf8');
      await renameSessionIdentity(true, connection);
      await connection.query('ALTER TABLE player_submissions RENAME COLUMN submitted_at TO submitted_at_utc');
      for (const statement of migration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await connection.query(statement);
      await connection.query('ALTER TABLE player_submissions RENAME COLUMN submitted_at_utc TO submitted_at');
      await renameSessionIdentity(false, connection);
      const [[zone]] = await connection.query<RowDataPacket[]>('SELECT @@session.time_zone AS zone');
      assert.equal(zone.zone, '+05:30');
      await connection.query("SET time_zone = '+00:00'");
      const [after] = await connection.query('SELECT * FROM players ORDER BY id');
      assert.deepEqual(after, before);
    } finally { connection.release(); }
  });
  it('backfills session details and renames IDs without changing history or references', async () => {
    const client = player();
    const started = (await client.request('/start', {})).data.game.startedAt;
    const stored = async () => (await pool.execute<RowDataPacket[]>(`SELECT g.* FROM game_sessions g
      JOIN players p ON p.id = g.player_id WHERE p.token_hash = ?`, [client.hash]))[0][0];
    assert.equal((await stored()).expires_at.getTime(), started + GAME_DURATION);
    assert.equal((await stored()).created_at.getTime(), started);
    assert.equal((await stored()).remaining_time_ms, 0);
    await answer(client, 'Moon');
    await answer(client, 'Burma');
    await answer(client, 'Myanmar');
    assert.equal((await stored()).total_submissions, 3);
    now += 5049;
    for (const value of ['Mexico', 'Malta', 'Morocco', 'Mali']) await answer(client, value);
    assert.equal((await stored()).total_submissions, 7);
    assert.equal((await stored()).remaining_time_ms, 24951);
    assert.equal((await stored()).score, 749);
    const original = (await client.request()).data;
    assert.equal((await stored()).total_submissions, 7);
    const connection = await pool.getConnection();
    try {
      await connection.query("SET time_zone = '+00:00'");
      const [before] = await connection.query('SELECT * FROM game_sessions ORDER BY id');
      const [submissions] = await connection.query('SELECT * FROM player_submissions ORDER BY id');
      const [scores] = await connection.query('SELECT * FROM player_scores ORDER BY session_id');
      await renameSessionIdentity(true, connection);
      await connection.query(`ALTER TABLE game_sessions DROP COLUMN expires_at, DROP COLUMN total_submissions,
        DROP COLUMN created_at, DROP COLUMN remaining_time_ms`);
      await connection.query("SET time_zone = '+05:30'");
      const migration = await readFile(new URL('../database/migrations/008_session_details.sql', import.meta.url), 'utf8');
      for (const statement of migration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await connection.query(statement);
      await renameSessionIdentity(false, connection);
      const [[zone]] = await connection.query<RowDataPacket[]>('SELECT @@session.time_zone AS zone');
      assert.equal(zone.zone, '+05:30');
      await connection.query("SET time_zone = '+00:00'");
      const [after] = await connection.query('SELECT * FROM game_sessions ORDER BY id');
      assert.deepEqual(after, before);
      assert.deepEqual((await connection.query('SELECT * FROM player_submissions ORDER BY id'))[0], submissions);
      assert.deepEqual((await connection.query('SELECT * FROM player_scores ORDER BY session_id'))[0], scores);
      const [expired] = await connection.query<RowDataPacket[]>("SELECT remaining_time_ms, expires_at, finished_at FROM game_sessions WHERE status = 'expired'");
      assert.ok(expired.length > 0);
      for (const session of expired) {
        assert.equal(session.remaining_time_ms, 0);
        assert.deepEqual(session.expires_at, session.finished_at);
      }
    } finally { connection.release(); }
    assert.deepEqual((await client.request()).data, original);
  });
  it('links existing sessions to challenge IDs and rejects mismatched dates', async () => {
    const client = player();
    await client.request('/start', {});
    await answer(client, 'Mexico');
    const original = (await client.request()).data;
    const [before] = await pool.query('SELECT * FROM game_sessions ORDER BY id');
    await removeSessionChallengeIds();
    const migration = await readFile(new URL('../database/migrations/009_session_challenges.sql', import.meta.url), 'utf8');
    for (const statement of migration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await pool.query(statement);
    const [after] = await pool.query('SELECT * FROM game_sessions ORDER BY id');
    assert.deepEqual(after, before);
    const [links] = await pool.query<RowDataPacket[]>(`SELECT g.id AS session_id, g.challenge_id, c.id
      FROM game_sessions g JOIN daily_challenges c ON c.challenge_date = g.challenge_date`);
    assert.ok(links.length > 0);
    for (const link of links) assert.equal(link.challenge_id, link.id);
    const [[own]] = await pool.execute<RowDataPacket[]>(`SELECT g.id, g.challenge_id FROM game_sessions g
      JOIN players p ON p.id = g.player_id WHERE p.token_hash = ?`, [client.hash]);
    const [[other]] = await pool.execute<RowDataPacket[]>('SELECT id FROM daily_challenges WHERE id <> ? LIMIT 1', [own.challenge_id]);
    await assert.rejects(pool.execute('UPDATE game_sessions SET challenge_id = ? WHERE id = ?',
      [other.id, own.id]), { code: 'ER_NO_REFERENCED_ROW_2' });
    const [unique] = await pool.query<RowDataPacket[]>("SHOW INDEX FROM game_sessions WHERE Key_name = 'uq_session_player_challenge'");
    assert.deepEqual(unique.map(index => index.Column_name), ['player_id', 'challenge_id']);
    const [scores] = await pool.query<RowDataPacket[]>("SHOW INDEX FROM game_sessions WHERE Key_name = 'ix_session_challenge_score'");
    assert.deepEqual(scores.map(index => index.Column_name), ['challenge_id', 'score']);
    assert.equal(scores[1].Collation, 'D');
    assert.deepEqual((await client.request()).data, original);
  });
  it('backfills submission details and renames input fields without losing history', async () => {
    const client = player();
    const started = (await client.request('/start', {})).data.game.startedAt;
    now += 1234;
    assert.equal((await answer(client, '  BÚRMA\t')).data.accepted, true);
    now += 500;
    assert.equal((await answer(client, 'Myanmar')).data.accepted, false);
    await answer(client, 'Moon\u00a0 \t');
    assert.equal((await answer(client, '\uFDFA'.repeat(80))).status, 400);
    const [rows] = await pool.execute<RowDataPacket[]>(`SELECT s.* FROM player_submissions s JOIN game_sessions g ON g.id = s.session_id
      JOIN players p ON p.id = g.player_id WHERE p.token_hash = ? ORDER BY s.id`, [client.hash]);
    assert.deepEqual(rows.map(row => [row.submitted_text, row.normalized_text, row.response_time_ms, row.result]), [
      ['  BÚRMA\t', 'burma', 1234, 'correct'], ['Myanmar', 'myanmar', 1734, 'duplicate'], ['Moon\u00a0 \t', 'moon', 1734, 'incorrect'],
    ]);
    now = started + 5049;
    for (const value of ['Mexico', 'Malta', 'Morocco', 'Mali']) await answer(client, value);
    const original = (await client.request()).data;
    assert.equal(original.game.score.total, 749);
    const connection = await pool.getConnection();
    try {
      await connection.query("SET time_zone = '+00:00'");
      const legacy = Array.from({ length: 501 }, (_, i) => [rows[0].session_id, rows[0].challenge_date,
        new Date(started + 2000), `  Legacy ${i}  `, `legacy ${i}`, 2000, 'incorrect']);
      await connection.query(`INSERT INTO player_submissions
        (session_id, challenge_date, submitted_at, submitted_text, normalized_text, response_time_ms, result) VALUES ?`, [legacy]);
      await connection.execute('UPDATE game_sessions SET total_submissions = total_submissions + ? WHERE id = ?', [legacy.length, rows[0].session_id]);
      const snapshot = async () => Promise.all([['game_sessions', 'id'], ['player_submissions', 'id'], ['players', 'id']]
        .map(async ([table, key]) => (await connection.query(`SELECT * FROM ${table} ORDER BY ${key}`))[0]));
      const before = await snapshot();
      await restoreLegacySubmissionIdentity(connection);
      await connection.query(`ALTER TABLE player_submissions RENAME COLUMN submitted_text TO guess,
        RENAME COLUMN submitted_at TO submitted_at_utc`);
      await connection.query(`ALTER TABLE player_submissions DROP INDEX ix_submission_received, DROP INDEX ix_submission_answer_result,
        DROP COLUMN normalized_text, DROP COLUMN response_time_ms, MODIFY COLUMN guess VARCHAR(191) NOT NULL`);
      await renameSessionIdentity(true, connection);
      await migrateSubmissionDetails(connection);
      await renameSessionIdentity(false, connection);
      await connection.query(await readFile(new URL('../database/migrations/012_submission_input_fields.sql', import.meta.url), 'utf8'));
      await migrateSubmissionIdentity(connection);
      assert.deepEqual(await snapshot(), before);
      const [indexes] = await connection.query<RowDataPacket[]>("SHOW INDEX FROM player_submissions WHERE Key_name = 'ix_submission_received'");
      assert.deepEqual(indexes.map(index => index.Column_name), ['session_id', 'submitted_at']);
    } finally { connection.release(); }
    assert.deepEqual((await client.request()).data, original);
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
  it('enforces challenge availability without consuming attempts or interrupting existing games', async () => {
    const waiting = player(), started = player();
    now = Date.parse(new Date().toISOString().slice(0, 10) + 'T12:00:00Z');
    const challenge = getDailyChallenge(now);
    await started.request('/start', {});
    await waiting.request();
    const [before] = await pool.query('SELECT * FROM daily_challenges ORDER BY id');
    await pool.query(`CREATE OR REPLACE SQL SECURITY INVOKER VIEW current_challenge AS
      SELECT challenge_date, category, prompt FROM daily_challenges WHERE challenge_date = UTC_DATE()`);
    await pool.query(await readFile(new URL('../database/migrations/018_challenge_availability.sql', import.meta.url), 'utf8'));
    assert.deepEqual((await pool.query('SELECT * FROM daily_challenges ORDER BY id'))[0], before);
    try {
      for (const settings of [[0, 30, 5], [1, 45, 5], [1, 30, 4]]) {
        await pool.execute('UPDATE daily_challenges SET is_active = ?, time_limit = ?, required_answers = ? WHERE challenge_date = ?', [...settings, challenge.date]);
        for (const request of [() => waiting.request(), () => waiting.request('/start', {}),
          () => answer(waiting, challenge.answers[0][0])]) {
          const reply = await request();
          assert.equal(reply.status, 200);
          assert.equal(reply.data.game.status, 'unavailable');
          assert.equal(reply.data.game.startedAt, null);
          assert.equal(reply.data.accepted, false);
          assert.deepEqual(reply.data.results, []);
        }
        assert.deepEqual((await pool.query('SELECT * FROM current_challenge'))[0], []);
        if (!settings[0]) {
          now += 5049;
          for (const variants of challenge.answers.slice(0, 5)) assert.equal((await answer(started, variants[0])).data.accepted, true);
        }
        const finished = (await started.request()).data.game;
        assert.equal(finished.status, 'finished');
        assert.equal(finished.score.total, 749);
      }
      const [[count]] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS attempts FROM game_sessions g
        JOIN players p ON p.id = g.player_id WHERE p.token_hash = ?`, [waiting.hash]);
      assert.equal(count.attempts, 0);
    } finally {
      await pool.execute('UPDATE daily_challenges SET is_active = 1, time_limit = 30, required_answers = 5 WHERE challenge_date = ?', [challenge.date]);
    }
    assert.equal(((await pool.query('SELECT * FROM current_challenge'))[0] as RowDataPacket[]).length, 1);
    assert.equal((await waiting.request()).data.game.status, 'ready');
    assert.equal((await waiting.request('/start', {})).data.game.status, 'playing');
  });
  it('migrates practice storage and permits replay without changing daily progress', async () => {
    const [[fresh]] = await pool.query<RowDataPacket[]>('SHOW CREATE TABLE practice_sessions');
    await pool.query('DROP TABLE practice_sessions');
    const migration = await readFile(new URL('../database/migrations/019_practice_sessions.sql', import.meta.url), 'utf8');
    const migrate = async () => {
      for (const sql of migration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await pool.query(sql);
      await migratePracticeSkips(pool);
    };
    await migrate();
    const [[upgraded]] = await pool.query<RowDataPacket[]>('SHOW CREATE TABLE practice_sessions');
    assert.deepEqual(upgraded, fresh);
    const client = player();
    const daily = (await client.request()).data;
    const [[owner]] = await pool.execute<RowDataPacket[]>('SELECT id FROM players WHERE token_hash = ?', [client.hash]);
    const [dailyRows] = await pool.query('SELECT * FROM game_sessions ORDER BY id');
    const challenge = getPracticeChallenge('dog-breeds')!;
    const insert = (id: string) => pool.execute(`INSERT INTO practice_sessions
      (id, player_id, challenge_key, theme, category, prompt, answer_keys, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, owner.id, challenge.id, challenge.theme, challenge.category, challenge.prompt, JSON.stringify(challenge.answers), '2026-11-18 23:59:58.000']);
    const first = randomUUID();
    await insert(first);
    await assert.rejects(insert(randomUUID()), { code: 'ER_DUP_ENTRY' });
    await assert.rejects(pool.execute('UPDATE practice_sessions SET player_id = ? WHERE id = ?',
      [randomUUID(), first]), { code: 'ER_NO_REFERENCED_ROW_2' });
    for (const change of ["answer_keys = JSON_ARRAY()", "answers = JSON_OBJECT()", "answers = JSON_ARRAY(1,2,3,4,5,6)",
      "status = 'expired', finished_at = '2026-11-19 00:00:27.999'"]) {
      await assert.rejects(pool.execute(`UPDATE practice_sessions SET ${change} WHERE id = ?`, [first]),
        { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
    }
    const answers = challenge.answers.slice(0, 5).map(variants => variants[0]);
    await assert.rejects(pool.execute("UPDATE practice_sessions SET answers = ?, status = 'completed', finished_at = ? WHERE id = ?",
      [JSON.stringify(answers), '2026-11-19 00:00:28.000', first]), { code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
    await pool.execute("UPDATE practice_sessions SET answers = ?, status = 'completed', finished_at = ? WHERE id = ?",
      [JSON.stringify(answers), '2026-11-19 00:00:03.049', first]);
    const [[solved]] = await pool.execute<RowDataPacket[]>('SELECT * FROM practice_sessions WHERE id = ?', [first]);
    assert.equal(solved.correct_answers, 5);
    assert.equal(solved.score, 749);
    assert.equal(Number(solved.remaining_seconds), 24.951);
    assert.deepEqual(solved.answer_keys, challenge.answers);
    const second = randomUUID();
    await insert(second);
    await pool.execute("UPDATE practice_sessions SET answers = ?, status = 'expired', finished_at = expires_at WHERE id = ?",
      [JSON.stringify(answers.slice(0, 2)), second]);
    const [[expired]] = await pool.execute<RowDataPacket[]>('SELECT score FROM practice_sessions WHERE id = ?', [second]);
    assert.equal(expired.score, 200);
    await insert(randomUUID());
    const [before] = await pool.query('SELECT * FROM practice_sessions ORDER BY id');
    await migrate();
    assert.deepEqual((await pool.query('SELECT * FROM practice_sessions ORDER BY id'))[0], before);
    assert.deepEqual((await pool.query('SELECT * FROM game_sessions ORDER BY id'))[0], dailyRows);
    assert.deepEqual((await client.request()).data, daily);
    const [[stats]] = await pool.execute<RowDataPacket[]>('SELECT total_games, total_score, current_streak FROM players WHERE id = ?', [owner.id]);
    assert.deepEqual({ ...stats }, { total_games: 0, total_score: 0, current_streak: 0 });
  });
  it('starts and restores owned practice rounds without resetting timers or daily progress', async () => {
    const client = player(), stranger = player();
    const daily = (await client.request()).data;
    for (const body of [{}, { challengeId: 'missing' }, { challengeId: 'dog-breeds', score: 800 }]) {
      assert.equal((await client.request('/practice/start', body)).status, 400);
    }
    const [first, concurrent] = await Promise.all([
      client.request('/practice/start', { challengeId: 'dog-breeds' }),
      client.request('/practice/start', { challengeId: 'solar-system-planets' }),
    ]);
    assert.equal(first.status, 200);
    assert.equal(concurrent.status, 200);
    assert.deepEqual(concurrent.data.game, first.data.game);
    const game = first.data.game;
    assert.equal(game.mode, 'practice');
    assert.equal(game.status, 'playing');
    assert.equal(game.startedAt, now);
    assert.deepEqual(game.answers, []);
    assert.deepEqual(Object.keys(game).sort(), ['answers', 'challenge', 'finishedAt', 'id', 'mode', 'score', 'startedAt', 'status']);
    assert.deepEqual(Object.keys(game.challenge).sort(), ['category', 'date', 'id', 'number', 'prompt', 'theme']);
    assert.equal(Object.hasOwn(first.data, 'results'), false);
    now += 5049;
    const read = await client.request(`/practice/${game.id}`);
    assert.deepEqual(read.data.game, game);
    const [resumed, dailyRead] = await Promise.all([
      client.request('/practice/start', { challengeId: 'countries-m' }), client.request(),
    ]);
    assert.equal(dailyRead.status, 200);
    assert.deepEqual(dailyRead.data.game, daily.game);
    assert.deepEqual(resumed.data.game, game);
    assert.equal((await stranger.request(`/practice/${game.id}`)).status, 404);
    assert.equal((await client.request(`/practice/${randomUUID()}`)).status, 404);
    now = game.startedAt + GAME_DURATION;
    const expired = await client.request(`/practice/${game.id}`);
    assert.equal(expired.data.game.status, 'finished');
    assert.equal(expired.data.game.finishedAt, now);
    assert.equal(expired.data.game.score.total, 0);
    const replay = await client.request('/practice/start', { challengeId: 'dog-breeds' });
    assert.equal(replay.status, 200);
    assert.notEqual(replay.data.game.id, game.id);
    assert.equal(replay.data.game.startedAt, now);
    assert.equal(replay.data.game.challenge.id, 'dog-breeds');
    assert.deepEqual((await client.request(`/practice/${game.id}`)).data.game, expired.data.game);
    const after = (await client.request()).data;
    assert.deepEqual(after.game, daily.game);
    assert.deepEqual(after.results, daily.results);
  });
  it('validates practice answers, scores completion, and isolates replays and daily statistics', async () => {
    const client = player(), stranger = player();
    const daily = (await client.request()).data;
    const start = await client.request('/practice/start', { challengeId: 'dog-breeds' });
    const { id, startedAt } = start.data.game;
    const path = `/practice/${id}/answers`;
    const guess = (answer: string, sessionId = id) => client.request(`/practice/${sessionId}/answers`, { answer });
    for (const body of [{}, { answer: ' ' }, { answer: 123 }, { answer: 'a'.repeat(81) },
      { answer: '\uFDFA'.repeat(80) }, { answer: 'Lab', score: 800 }]) {
      assert.equal((await client.request(path, body)).status, 400);
    }
    assert.equal((await client.request(path, { answer: 'Lab' }, { Origin: 'https://foreign.example' })).status, 403);
    assert.equal((await stranger.request(path, { answer: 'Lab' })).status, 404);
    assert.equal((await guess('Lab', randomUUID())).status, 404);
    const wrong = await guess("Moon' OR 1=1 --");
    assert.equal(wrong.data.accepted, false);
    assert.deepEqual(wrong.data.game.answers, []);
    const snapshot = getPracticeChallenge('dog-breeds')!.answers;
    snapshot[0].push('old lab');
    await pool.execute('UPDATE practice_sessions SET answer_keys = ? WHERE id = ?', [JSON.stringify(snapshot), id]);
    const aliases = await Promise.all([guess('old lab'), guess('  LÁBRADOR  ')]);
    assert.equal(aliases.filter(reply => reply.data.accepted).length, 1);
    assert.ok(aliases.some(reply => /already/i.test(reply.data.feedback.text)));
    assert.deepEqual(aliases[0].data.game.answers, ['Labrador Retriever']);
    assert.deepEqual(aliases[0].data.game.score, { correctness: 100, speed: 0, total: 100 });
    now += 5049;
    let result = aliases[0].data;
    for (const value of ['Golden Retriever', 'German Shepherd Dog', 'Beagle', 'Poodle']) {
      const reply = await guess(value);
      assert.equal(reply.status, 200);
      assert.equal(reply.data.accepted, true);
      result = reply.data;
    }
    assert.equal(result.game.status, 'finished');
    assert.equal(result.game.finishedAt, startedAt + 5049);
    assert.deepEqual(result.game.score, { correctness: 500, speed: 249, total: 749 });
    const [[stored]] = await pool.execute<RowDataPacket[]>('SELECT answers, score, finished_at FROM practice_sessions WHERE id = ?', [id]);
    assert.deepEqual(stored.answers, result.game.answers);
    assert.equal(stored.score, 749);
    assert.equal(stored.finished_at.getTime(), result.game.finishedAt);
    const completed = await guess('Boxer');
    assert.equal(completed.data.accepted, false);
    assert.deepEqual(completed.data.game, result.game);
    const replay = (await client.request('/practice/start', { challengeId: 'solar-system-planets' })).data.game;
    assert.notEqual(replay.id, id);
    assert.deepEqual(replay.answers, []);
    assert.equal((await guess('Boxer')).data.accepted, false);
    assert.deepEqual((await client.request(`/practice/${replay.id}`)).data.game, replay);
    now = replay.startedAt + GAME_DURATION;
    const late = await guess('Earth', replay.id);
    assert.equal(late.data.accepted, false);
    assert.equal(late.data.game.status, 'finished');
    assert.equal(late.data.game.finishedAt, now);
    assert.deepEqual(late.data.game.answers, []);
    assert.equal(late.data.game.score.total, 0);
    const third = (await client.request('/practice/start', { challengeId: 'countries-m' })).data.game;
    assert.notEqual(third.id, replay.id);
    assert.equal(third.status, 'playing');
    assert.equal((await guess('Mars', replay.id)).data.accepted, false);
    assert.deepEqual((await client.request(`/practice/${third.id}`)).data.game.answers, []);
    const after = (await client.request()).data;
    assert.deepEqual(after.game, daily.game);
    assert.deepEqual(after.results, daily.results);
    const [[stats]] = await pool.execute<RowDataPacket[]>('SELECT total_games, total_score, current_streak FROM players WHERE token_hash = ?', [client.hash]);
    assert.deepEqual({ ...stats }, { total_games: 0, total_score: 0, current_streak: 0 });
  });
  it('autocorrects daily and practice answers while storing canonical credit only once', async () => {
    const daily = player();
    await daily.request('/start', {});
    const corrected = await answer(daily, 'Madagscar');
    assert.equal(corrected.data.accepted, true);
    assert.deepEqual(corrected.data.game.answers, ['Madagascar']);
    assert.equal((await answer(daily, 'Madagascra')).data.accepted, false);
    const [[stored]] = await pool.execute<RowDataPacket[]>(`SELECT s.submitted_text, s.normalized_text, a.answer
      FROM player_submissions s JOIN accepted_answers a ON a.id = s.answer_id
      JOIN game_sessions g ON g.id = s.session_id JOIN players p ON p.id = g.player_id
      WHERE p.token_hash = ? AND s.result = 'correct'`, [daily.hash]);
    assert.deepEqual([stored.submitted_text, stored.normalized_text, stored.answer], ['Madagscar', 'madagscar', 'Madagascar']);
    assert.equal((await answer(daily, 'FSM')).data.accepted, true);
    assert.equal((await answer(daily, 'Federated States of Micronesia')).data.accepted, false);
    const client = player();
    const before = (await client.request()).data;
    const { id } = (await client.request('/practice/start', { challengeId: 'programming-languages' })).data.game;
    const guess = (answer: string) => client.request(`/practice/${id}/answers`, { answer });
    assert.equal((await guess('brainfck')).data.accepted, true);
    assert.equal((await guess('Brainfuck')).data.accepted, false);
    assert.equal((await guess('Chef')).data.accepted, true);
    assert.equal((await guess('holy c')).data.accepted, true);
    assert.equal((await guess('HolyC')).data.accepted, false);
    assert.equal((await guess('C')).data.accepted, true);
    const completed = (await guess('C++')).data.game;
    assert.equal(completed.status, 'finished');
    assert.deepEqual(completed.answers, ['Brainfuck', 'Chef', 'HolyC', 'C', 'C++']);
    assert.equal(completed.score.correctness, 500);
    assert.deepEqual((await client.request()).data, before);
  });
  it('validates one answer per theme within one random session, timer, and final score', async () => {
    const client = player(), stranger = player();
    const daily = (await client.request()).data;
    for (const body of [{ challengeId: 'programming-languages' }, { questions: [] }, { score: 800 }]) {
      assert.equal((await client.request('/practice/random/start', body)).status, 400);
    }
    const starts = await Promise.all([client.request('/practice/random/start', {}), client.request('/practice/random/start', {})]);
    const initial = starts[0].data.game;
    assert.equal(starts[0].status, 200);
    assert.deepEqual(starts[1].data.game, initial);
    assert.equal(initial.mode, 'practice');
    assert.equal(initial.variant, 'random');
    assert.equal(initial.questions.length, 5);
    assert.equal(new Set(initial.questions.map((question: any) => question.theme)).size, 5);
    assert.deepEqual(initial.answers, []);
    assert.equal(JSON.stringify(initial).includes('answer_keys'), false);
    assert.equal(initial.questions.some((question: any) => 'answers' in question), false);
    assert.equal((await stranger.request(`/practice/${initial.id}`)).status, 404);
    const guess = (answer: string, index = 0) => client.request(`/practice/${initial.id}/answers`, { answer, questionId: initial.questions[index].id });
    assert.equal((await guess('not-a-real-answer-123456789')).data.accepted, false);
    let completed = initial;
    const credited: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      const challenge = getPracticeChallenge(initial.questions[index].id)!;
      const candidate = challenge.answers.find((variants: string[]) => !credited.includes(variants[0]))![0];
      now = initial.startedAt + (index + 1) * 1000;
      const submissions = await Promise.all([guess(candidate, index), guess(candidate, index)]);
      assert.equal(submissions.filter(response => response.data.accepted).length, 1);
      const accepted = submissions.find(response => response.data.accepted)!.data.game;
      credited.push(candidate);
      assert.deepEqual(accepted.answers, credited);
      assert.equal(accepted.id, initial.id);
      assert.equal(accepted.startedAt, initial.startedAt);
      assert.equal(accepted.status, index === 4 ? 'finished' : 'playing');
      if (index < 4) {
        assert.equal(accepted.challenge.prompt, initial.questions[index + 1].prompt);
        assert.equal(accepted.challenge.category, initial.questions[index + 1].category);
        assert.deepEqual((await client.request('/practice/random/start', {})).data.game, accepted);
        assert.deepEqual((await client.request(`/practice/${initial.id}`)).data.game, accepted);
      }
      completed = accepted;
    }
    assert.deepEqual(completed.score, { correctness: 500, speed: 250, total: 750 });
    const [[stored]] = await pool.execute<RowDataPacket[]>('SELECT answers, score, started_at, finished_at FROM practice_sessions WHERE id = ?', [initial.id]);
    assert.deepEqual(stored.answers, credited);
    assert.equal(stored.score, 750);
    assert.equal(stored.finished_at.getTime() - stored.started_at.getTime(), 5000);
    const dailyAfter = (await client.request()).data;
    assert.deepEqual(dailyAfter.game, daily.game);
    assert.deepEqual(dailyAfter.results, daily.results);
    const [[stats]] = await pool.execute<RowDataPacket[]>('SELECT total_games, total_score, current_streak FROM players WHERE token_hash = ?', [client.hash]);
    assert.deepEqual({ ...stats }, { total_games: 0, total_score: 0, current_streak: 0 });
  });

  it('expires the whole mixed-theme round on the original deadline and allows a fresh replay', async () => {
    const client = player();
    const game = (await client.request('/practice/random/start', {})).data.game;
    const candidate = getPracticeChallenge(game.questions[0].id)!.answers[0][0];
    now = game.startedAt + 1000;
    const first = (await client.request(`/practice/${game.id}/answers`, { answer: candidate, questionId: game.questions[0].id })).data.game;
    assert.deepEqual(first.answers, [candidate]);
    now = game.startedAt + GAME_DURATION;
    const expired = (await client.request(`/practice/${game.id}`)).data.game;
    assert.equal(expired.status, 'finished');
    assert.equal(expired.finishedAt, game.startedAt + GAME_DURATION);
    assert.deepEqual(expired.score, { correctness: 100, speed: 0, total: 100 });
    assert.deepEqual(expired.questions, game.questions);
    assert.equal((await client.request(`/practice/${game.id}/answers`, { answer: candidate })).data.accepted, false);
    const replay = (await client.request('/practice/random/start', {})).data.game;
    assert.notEqual(replay.id, game.id);
    assert.equal(replay.startedAt, now);
    assert.deepEqual(replay.answers, []);
    assert.equal(replay.variant, 'random');
  });

  it('keeps mixed-theme answer validation and prompts in the saved server snapshot', async () => {
    const client = player();
    const game = (await client.request('/practice/random/start', {})).data.game;
    const [[stored]] = await pool.execute<RowDataPacket[]>('SELECT answer_keys FROM practice_sessions WHERE id = ?', [game.id]);
    const snapshot = stored.answer_keys;
    snapshot[0].answers = [['Private accepted value'], ['First extra A'], ['First extra B'], ['First extra C'], ['First extra D']];
    snapshot[1].prompt = 'Name one saved test answer';
    snapshot[1].answers = [['StoredSecond'], ['Second extra A'], ['Second extra B'], ['Second extra C'], ['Second extra D']];
    await pool.execute('UPDATE practice_sessions SET answer_keys = ? WHERE id = ?', [JSON.stringify(snapshot), game.id]);
    now = game.startedAt + 500;
    const first = (await client.request(`/practice/${game.id}/answers`, { answer: 'Private accepted value', questionId: game.questions[0].id })).data;
    assert.equal(first.accepted, true);
    assert.equal(first.game.challenge.prompt, 'Name one saved test answer');
    assert.equal(first.game.startedAt, game.startedAt);
    assert.equal(JSON.stringify(first.game).includes('Private accepted value'), true);
    assert.equal(JSON.stringify(first.game.questions).includes('StoredSecond'), false);
    const second = (await client.request(`/practice/${game.id}/answers`, { answer: 'StoredSecond', questionId: game.questions[1].id })).data;
    assert.equal(second.accepted, true);
    assert.deepEqual(second.game.answers, ['Private accepted value', 'StoredSecond']);
  });

  it('upgrades existing practice records for skipping without changing saved answers or scores', async () => {
    const [before] = await pool.query('SELECT * FROM practice_sessions ORDER BY id');
    await pool.query(`ALTER TABLE practice_sessions
      DROP CHECK ck_practice_skips, DROP CHECK ck_practice_state, DROP COLUMN skipped_questions, DROP COLUMN score,
      MODIFY COLUMN remaining_seconds DECIMAL(5,3) UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status = 'completed' THEN 30 - TIMESTAMPDIFF(MICROSECOND, started_at, finished_at) / 1000000 ELSE 0 END
      ) STORED,
      ADD COLUMN score SMALLINT UNSIGNED GENERATED ALWAYS AS (FLOOR(100 * correct_answers + 10 * remaining_seconds)) STORED AFTER remaining_seconds,
      ADD CONSTRAINT ck_practice_state CHECK (
        (status = 'active' AND finished_at IS NULL AND correct_answers < 5)
        OR (status = 'completed' AND correct_answers = 5 AND finished_at IS NOT NULL AND finished_at >= started_at AND finished_at < expires_at)
        OR (status = 'expired' AND correct_answers < 5 AND finished_at IS NOT NULL AND finished_at = expires_at)
      )`);
    await migratePracticeSkips(pool);
    await migratePracticeSkips(pool);
    assert.deepEqual((await pool.query('SELECT * FROM practice_sessions ORDER BY id'))[0], before);
  });

  it('replaces the current question without consuming a slot, score, or time', async () => {
    const client = player(), stranger = player();
    const daily = (await client.request()).data;
    const game = (await client.request('/practice/random/start', {})).data.game;
    const path = `/practice/${game.id}/skip`;
    for (const body of [{}, { questionId: 1 }, { questionId: game.questions[0].id, score: 100 }]) {
      assert.equal((await client.request(path, body)).status, 400);
    }
    assert.equal((await stranger.request(path, { questionId: game.questions[0].id })).status, 404);
    now = game.startedAt + 2000;
    const replacements = await Promise.all([client.request(path, { questionId: game.questions[0].id }), client.request(path, { questionId: game.questions[0].id })]);
    assert.equal(replacements.filter(reply => reply.data.accepted).length, 1);
    const replaced = replacements.find(reply => reply.data.accepted)!.data.game;
    assert.notEqual(replaced.questions[0].id, game.questions[0].id);
    assert.deepEqual(replaced.questions.slice(1), game.questions.slice(1));
    assert.equal(new Set(replaced.questions.map((question: any) => question.theme)).size, 5);
    assert.equal(JSON.stringify(replaced.questions).includes('replacedIds'), false);
    assert.deepEqual(replaced.skipped, []);
    assert.deepEqual(replaced.answers, []);
    assert.equal(replaced.challenge.prompt, replaced.questions[0].prompt);
    assert.equal(replaced.startedAt, game.startedAt);
    assert.equal(replaced.id, game.id);
    assert.equal(replaced.score.total, 0);
    assert.deepEqual((await client.request(`/practice/${game.id}`)).data.game, replaced);
    const stale = await client.request(`/practice/${game.id}/answers`, { answer: getPracticeChallenge(game.questions[0].id)!.answers[0][0], questionId: game.questions[0].id });
    assert.equal(stale.data.accepted, false);
    const firstAnswer = getPracticeChallenge(replaced.questions[0].id)!.answers[0][0];
    now = game.startedAt + 3000;
    const first = (await client.request(`/practice/${game.id}/answers`, { answer: firstAnswer, questionId: replaced.questions[0].id })).data.game;
    assert.deepEqual(first.answers, [firstAnswer]);
    const next = (await client.request(path, { questionId: first.questions[1].id })).data.game;
    assert.deepEqual(next.questions[0], first.questions[0]);
    assert.deepEqual(next.answers, first.answers);
    assert.equal(next.score.total, 100);
    assert.notEqual(next.questions[1].id, first.questions[1].id);
    let finished = next;
    for (let index = 1; index < 5; index += 1) {
      now = game.startedAt + (index + 3) * 1000;
      const question = finished.questions[index];
      const answer = getPracticeChallenge(question.id)!.answers.find((variants: string[]) => !finished.answers.includes(variants[0]))![0];
      const response = await client.request(`/practice/${game.id}/answers`, { answer, questionId: question.id });
      assert.equal(response.data.accepted, true);
      finished = response.data.game;
    }
    assert.equal(finished.status, 'finished');
    assert.equal(finished.startedAt, game.startedAt);
    assert.equal(finished.finishedAt, now);
    assert.deepEqual(finished.skipped, []);
    assert.deepEqual(finished.score, { correctness: 500, speed: 230, total: 730 });
    const [[stored]] = await pool.execute<RowDataPacket[]>('SELECT score, correct_answers, skipped_questions, answer_keys FROM practice_sessions WHERE id = ?', [game.id]);
    assert.equal(stored.score, 730);
    assert.equal(stored.correct_answers, 5);
    assert.deepEqual(stored.skipped_questions, []);
    assert.equal(stored.answer_keys[0].id, replaced.questions[0].id);
    assert.ok(stored.answer_keys[0].replacedIds.includes(game.questions[0].id));
    assert.equal((await client.request(path, { questionId: finished.questions[4].id })).data.accepted, false);
    const replay = (await client.request('/practice/random/start', {})).data.game;
    assert.notEqual(replay.id, game.id);
    assert.deepEqual(replay.answers, []);
    const after = (await client.request()).data;
    assert.deepEqual(after.game, daily.game);
    assert.deepEqual(after.results, daily.results);
  });

  it('rejects skips after timeout and in single-theme practice', async () => {
    const client = player();
    const game = (await client.request('/practice/random/start', {})).data.game;
    now = game.startedAt + GAME_DURATION;
    const expired = (await client.request(`/practice/${game.id}/skip`, { questionId: game.questions[0].id })).data;
    assert.equal(expired.accepted, false);
    assert.equal(expired.game.status, 'finished');
    assert.deepEqual(expired.game.skipped, []);
    const single = (await client.request('/practice/start', { challengeId: 'dog-breeds' })).data.game;
    const denied = (await client.request(`/practice/${single.id}/skip`, { questionId: 'dog-breeds' })).data;
    assert.equal(denied.accepted, false);
    assert.deepEqual(denied.game.answers, []);
    assert.match(denied.feedback.text, /Random/);
  });
});
