-- Stop the API and back up the database. Apply once after migration 015.
-- Rename UTC timestamps without converting their values; rebuild dependent deadlines and scores.
ALTER TABLE game_sessions ADD INDEX ix_migration_session_date (challenge_date);
ALTER TABLE game_sessions
    DROP CHECK ck_session_start_day, DROP CHECK ck_session_state,
    DROP INDEX ix_session_daily_score, DROP INDEX ix_session_challenge_score,
    DROP COLUMN score, DROP COLUMN remaining_time_ms, DROP COLUMN remaining_seconds, DROP COLUMN expires_at;
ALTER TABLE game_sessions
    RENAME COLUMN started_at_utc TO started_at,
    RENAME COLUMN finished_at_utc TO finished_at;
ALTER TABLE game_sessions
    ADD COLUMN expires_at DATETIME(3) GENERATED ALWAYS AS (started_at + INTERVAL 30 SECOND) STORED,
    ADD COLUMN remaining_time_ms INT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status = 'solved' THEN 30000 - TIMESTAMPDIFF(MICROSECOND, started_at, finished_at) DIV 1000 ELSE 0 END
    ) STORED,
    ADD COLUMN remaining_seconds DECIMAL(5,3) UNSIGNED GENERATED ALWAYS AS (
        CASE status WHEN 'solved' THEN 30 - TIMESTAMPDIFF(MICROSECOND, started_at, finished_at) / 1000000 WHEN 'timed_out' THEN 0 END
    ) STORED,
    ADD COLUMN score SMALLINT UNSIGNED GENERATED ALWAYS AS (FLOOR(100 * correct_answers + 10 * remaining_seconds)) STORED,
    ADD INDEX ix_session_daily_score (challenge_date, score DESC),
    ADD INDEX ix_session_challenge_score (challenge_id, score DESC),
    ADD CONSTRAINT ck_session_start_day CHECK (DATE(started_at) = challenge_date),
    ADD CONSTRAINT ck_session_state CHECK (
        (status = 'in_progress' AND finished_at IS NULL AND correct_answers < 5)
        OR (status = 'solved' AND correct_answers = 5
            AND finished_at IS NOT NULL AND finished_at >= started_at
            AND finished_at < started_at + INTERVAL 30 SECOND)
        OR (status = 'timed_out' AND correct_answers < 5
            AND finished_at IS NOT NULL AND finished_at = started_at + INTERVAL 30 SECOND)
    );
ALTER TABLE game_sessions DROP INDEX ix_migration_session_date;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW player_scores AS
SELECT id AS session_id, player_id, challenge_date, status, correct_answers AS correct_count,
       remaining_seconds, score, finished_at AS finished_at_utc
FROM game_sessions
WHERE finished_at IS NOT NULL;
