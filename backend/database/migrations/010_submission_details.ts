import { pathToFileURL } from 'node:url';
import { createConnection } from 'mysql2/promise';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { normalizeAnswer } from '../../../shared/challenges.mjs';

// Apply once after 009 with the API stopped and a database backup.
export async function migrateSubmissionDetails(connection: Connection) {
  await connection.query(`ALTER TABLE player_submissions MODIFY COLUMN guess VARCHAR(255) NOT NULL,
    ADD COLUMN normalized_text VARCHAR(255) COLLATE utf8mb4_0900_bin NULL,
    ADD COLUMN response_time_ms INT UNSIGNED NULL`);
  await connection.beginTransaction();
  try {
    await connection.query(`UPDATE player_submissions s JOIN game_sessions g ON g.session_id = s.session_id
      SET s.response_time_ms = GREATEST(0, TIMESTAMPDIFF(MICROSECOND, g.started_at_utc, s.submitted_at_utc) DIV 1000)`);
    let cursor = '0';
    while (true) {
      const [rows] = await connection.execute<RowDataPacket[]>(`SELECT CAST(submission_id AS CHAR) AS id, guess
        FROM player_submissions WHERE submission_id > CAST(? AS UNSIGNED) ORDER BY submission_id LIMIT 500`, [cursor]);
      if (!rows.length) break;
      for (const row of rows) {
        const normalized = normalizeAnswer(row.guess);
        if ([...normalized].length > 255) throw new Error(`Submission ${row.id} exceeds the normalized text limit.`);
        await connection.execute('UPDATE player_submissions SET normalized_text = ? WHERE submission_id = CAST(? AS UNSIGNED)', [normalized, row.id]);
      }
      cursor = rows.at(-1)!.id;
    }
    await connection.commit();
  } catch (error) { await connection.rollback(); throw error; }
  await connection.query(`ALTER TABLE player_submissions
    MODIFY COLUMN normalized_text VARCHAR(255) COLLATE utf8mb4_0900_bin NOT NULL,
    MODIFY COLUMN response_time_ms INT UNSIGNED NOT NULL,
    ADD KEY ix_submission_received (session_id, submitted_at_utc),
    ADD KEY ix_submission_answer_result (answer_id, outcome)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL before running this migration.');
  const connection = await createConnection(process.env.DATABASE_URL);
  try { await migrateSubmissionDetails(connection); console.log('Submission details migrated.'); }
  finally { await connection.end(); }
}
