-- Stop the API and back up the database. Apply once after migration 016.
-- Map states explicitly, preserving UUIDs, timestamps, answer counts, and precise scores.
ALTER TABLE game_sessions ADD INDEX ix_migration_session_date (challenge_date);
ALTER TABLE game_sessions
    DROP CHECK ck_session_state, DROP INDEX ix_session_daily_score, DROP INDEX ix_session_challenge_score,
    DROP COLUMN score, DROP COLUMN remaining_time_ms, DROP COLUMN remaining_seconds;
ALTER TABLE game_sessions MODIFY COLUMN status
    ENUM('in_progress', 'solved', 'timed_out', 'active', 'completed', 'expired') NOT NULL DEFAULT 'in_progress';
UPDATE game_sessions SET status = CASE status
    WHEN 'in_progress' THEN 'active' WHEN 'solved' THEN 'completed' WHEN 'timed_out' THEN 'expired' ELSE status END;
ALTER TABLE game_sessions MODIFY COLUMN status ENUM('active', 'completed', 'expired') NOT NULL DEFAULT 'active';
ALTER TABLE game_sessions
    ADD COLUMN remaining_time_ms INT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status = 'completed' THEN 30000 - TIMESTAMPDIFF(MICROSECOND, started_at, finished_at) DIV 1000 ELSE 0 END
    ) STORED,
    ADD COLUMN remaining_seconds DECIMAL(5,3) UNSIGNED GENERATED ALWAYS AS (
        CASE status WHEN 'completed' THEN 30 - TIMESTAMPDIFF(MICROSECOND, started_at, finished_at) / 1000000 WHEN 'expired' THEN 0 END
    ) STORED,
    ADD COLUMN score SMALLINT UNSIGNED GENERATED ALWAYS AS (FLOOR(100 * correct_answers + 10 * remaining_seconds)) STORED,
    ADD INDEX ix_session_daily_score (challenge_date, score DESC),
    ADD INDEX ix_session_challenge_score (challenge_id, score DESC),
    ADD CONSTRAINT ck_session_state CHECK (
        (status = 'active' AND finished_at IS NULL AND correct_answers < 5)
        OR (status = 'completed' AND correct_answers = 5
            AND finished_at IS NOT NULL AND finished_at >= started_at
            AND finished_at < started_at + INTERVAL 30 SECOND)
        OR (status = 'expired' AND correct_answers < 5
            AND finished_at IS NOT NULL AND finished_at = started_at + INTERVAL 30 SECOND)
    );
ALTER TABLE game_sessions DROP INDEX ix_migration_session_date;
