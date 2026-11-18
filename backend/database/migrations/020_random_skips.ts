import type { Pool, RowDataPacket } from 'mysql2/promise';

export async function migratePracticeSkips(pool: Pool) {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    const [[lock]] = await connection.query<RowDataPacket[]>("SELECT GET_LOCK('quintle-practice-skips-v1', 30) AS acquired");
    if (Number(lock.acquired) !== 1) throw new Error('Could not prepare practice skip storage.');
    locked = true;
    const [[state]] = await connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS ready FROM information_schema.TABLE_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'practice_sessions' AND CONSTRAINT_NAME = 'ck_practice_skips'`);
    if (Number(state.ready)) return;
    await connection.query(`ALTER TABLE practice_sessions
      ADD COLUMN skipped_questions JSON NOT NULL DEFAULT (JSON_ARRAY()) AFTER answers,
      DROP CHECK ck_practice_state,
      DROP COLUMN score,
      MODIFY COLUMN remaining_seconds DECIMAL(5,3) UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status = 'completed' AND correct_answers = 5
          THEN 30 - TIMESTAMPDIFF(MICROSECOND, started_at, finished_at) / 1000000 ELSE 0 END
      ) STORED,
      ADD COLUMN score SMALLINT UNSIGNED GENERATED ALWAYS AS (FLOOR(100 * correct_answers + 10 * remaining_seconds)) STORED AFTER remaining_seconds,
      ADD CONSTRAINT ck_practice_skips CHECK (JSON_TYPE(skipped_questions) = 'ARRAY'
        AND JSON_LENGTH(skipped_questions) <= 5 AND (theme = 'random' OR JSON_LENGTH(skipped_questions) = 0)),
      ADD CONSTRAINT ck_practice_state CHECK (
        (status = 'active' AND finished_at IS NULL AND correct_answers + JSON_LENGTH(skipped_questions) < 5)
        OR (status = 'completed' AND correct_answers + JSON_LENGTH(skipped_questions) = 5 AND finished_at IS NOT NULL
          AND finished_at >= started_at AND finished_at < expires_at)
        OR (status = 'expired' AND correct_answers + JSON_LENGTH(skipped_questions) < 5 AND finished_at IS NOT NULL AND finished_at = expires_at)
      )`);
  } finally {
    try { if (locked) await connection.query("SELECT RELEASE_LOCK('quintle-practice-skips-v1')"); }
    finally { connection.release(); }
  }
}
