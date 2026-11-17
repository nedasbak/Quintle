import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import { createPool } from 'mysql2/promise';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { createApp } from '../src/app.ts';
import { createGameService } from '../src/game.ts';
import { GAME_DURATION } from '../../shared/gameRules.mjs';
import { getDailyChallenge } from '../../shared/challenges.mjs';
import { migrateSubmissionDetails } from '../database/migrations/010_submission_details.ts';

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
  async function renameSessionIdentity(legacy = false, connection: Pick<typeof pool, 'query'> = pool) {
    const migration = await readFile(new URL('../database/migrations/014_session_identity_field.sql', import.meta.url), 'utf8');
    const sql = legacy ? migration.replace('RENAME COLUMN session_id TO id', 'RENAME COLUMN id TO session_id')
      .replace('SELECT id AS session_id', 'SELECT session_id')
      .replace('REFERENCES game_sessions (id, challenge_date)', 'REFERENCES game_sessions (session_id, challenge_date)') : migration;
    for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await connection.query(statement);
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
      'SELECT g.score, g.remaining_seconds FROM game_sessions g JOIN players p ON p.id = g.player_id WHERE p.token_hash = ?', [client.hash]);
    assert.equal(stored.score, 749);
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
    assert.deepEqual([stored.total_submissions, stored.correct_count, stored.score, stored.total_games, stored.total_score], [7, 4, 400, 1, 400]);
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
  it('keeps records when applying the precise-scoring migration', async () => {
    // Migracija turi tikti ir jau veikiančiai bazei, ne tik naujai schemai.
    const [before] = await pool.query<RowDataPacket[]>('SELECT id, score FROM game_sessions ORDER BY id');
    const migration = await readFile(new URL('../database/migrations/001_precise_scoring.sql', import.meta.url), 'utf8');
    await pool.query('ALTER TABLE game_sessions DROP INDEX ix_session_challenge_score');
    const oldDefinition = migration.replace('DECIMAL(5,3)', 'TINYINT').replace(' / 1000000', ' DIV 1000000')
      .replace('FLOOR(100 * correct_count + 10 * remaining_seconds)', '100 * correct_count + 10 * remaining_seconds');
    await pool.query(oldDefinition);
    const [[rounded]] = await pool.query<RowDataPacket[]>('SELECT score FROM game_sessions WHERE id = ?', [before.find(row => row.score === 749)!.id]);
    assert.equal(rounded.score, 750);
    await pool.query(migration);
    await pool.query('ALTER TABLE game_sessions ADD INDEX ix_session_challenge_score (challenge_id, score DESC)');
    const [after] = await pool.query<RowDataPacket[]>('SELECT id, score FROM game_sessions ORDER BY id');
    assert.deepEqual(after, before);
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
      g.id, g.challenge_date, g.started_at_utc, g.finished_at_utc, g.status, g.correct_count, g.remaining_seconds, g.score,
      s.current_streak, s.longest_streak, s.last_played_date
      FROM players p LEFT JOIN game_sessions g ON g.player_id = p.id
      LEFT JOIN player_streaks s ON s.player_id = p.id ORDER BY token, g.id`))[0];
    const before = await snapshot();
    await pool.query('ALTER TABLE game_sessions DROP INDEX uq_session_player_challenge');
    await pool.query('ALTER TABLE players ADD COLUMN player_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, ADD UNIQUE KEY uq_legacy_player (player_id)');
    await pool.query('ALTER TABLE game_sessions ADD COLUMN legacy_player_id BIGINT UNSIGNED NULL');
    await pool.query('UPDATE game_sessions g JOIN players p ON p.id = g.player_id SET g.legacy_player_id = p.player_id');
    await pool.query('ALTER TABLE game_sessions DROP FOREIGN KEY fk_session_player');
    await pool.query(`ALTER TABLE game_sessions DROP INDEX uq_session_player_day, DROP COLUMN player_id,
      CHANGE COLUMN legacy_player_id player_id BIGINT UNSIGNED NOT NULL,
      ADD UNIQUE KEY uq_session_player_day (player_id, challenge_date)`);
    await pool.query('ALTER TABLE players DROP PRIMARY KEY, DROP COLUMN id, ADD PRIMARY KEY (player_id), DROP INDEX uq_legacy_player');
    await pool.query('ALTER TABLE game_sessions ADD CONSTRAINT fk_session_player FOREIGN KEY (player_id) REFERENCES players (player_id)');
    const migration = await readFile(new URL('../database/migrations/005_player_uuids.sql', import.meta.url), 'utf8');
    for (const statement of migration.replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await pool.query(statement);
    await pool.query('ALTER TABLE game_sessions ADD UNIQUE KEY uq_session_player_challenge (player_id, challenge_id)');
    assert.deepEqual(await snapshot(), before);
    assert.deepEqual((await client.request()).data, original);
    const [players] = await pool.query<RowDataPacket[]>('SELECT id FROM players');
    for (const player of players) assert.match(player.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const [[streaks]] = await pool.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM player_streaks');
    assert.equal(streaks.count, players.length);
    await assert.rejects(pool.query(`INSERT INTO game_sessions (id, player_id, challenge_id, challenge_date, started_at_utc)
      SELECT '00000000-0000-4000-8000-000000000000', player_id, challenge_id, challenge_date, started_at_utc FROM game_sessions LIMIT 1`), { code: 'ER_DUP_ENTRY' });
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
      const [expired] = await connection.query<RowDataPacket[]>("SELECT remaining_time_ms, expires_at, finished_at_utc FROM game_sessions WHERE status = 'timed_out'");
      assert.ok(expired.length > 0);
      for (const session of expired) {
        assert.equal(session.remaining_time_ms, 0);
        assert.deepEqual(session.expires_at, session.finished_at_utc);
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
});
