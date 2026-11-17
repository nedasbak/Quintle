-- Stop the API and back up the database. Apply once after migration 014.
-- Rebuild dependent scores and checks without changing accepted answers or completion times.
ALTER TABLE game_sessions ADD INDEX ix_migration_session_date (challenge_date);
ALTER TABLE game_sessions
    DROP CHECK ck_session_state, DROP INDEX ix_session_daily_score,
    DROP INDEX ix_session_challenge_score, DROP COLUMN score;
ALTER TABLE game_sessions RENAME COLUMN correct_count TO correct_answers;
ALTER TABLE game_sessions
    ADD COLUMN score SMALLINT UNSIGNED GENERATED ALWAYS AS (
        FLOOR(100 * correct_answers + 10 * remaining_seconds)
    ) STORED,
    ADD INDEX ix_session_daily_score (challenge_date, score DESC),
    ADD INDEX ix_session_challenge_score (challenge_id, score DESC),
    ADD CONSTRAINT ck_session_state CHECK (
        (status = 'in_progress' AND finished_at_utc IS NULL AND correct_answers < 5)
        OR (status = 'solved' AND correct_answers = 5
            AND finished_at_utc IS NOT NULL AND finished_at_utc >= started_at_utc
            AND finished_at_utc < started_at_utc + INTERVAL 30 SECOND)
        OR (status = 'timed_out' AND correct_answers < 5
            AND finished_at_utc IS NOT NULL AND finished_at_utc = started_at_utc + INTERVAL 30 SECOND)
    );
ALTER TABLE game_sessions DROP INDEX ix_migration_session_date;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW player_scores AS
SELECT id AS session_id, player_id, challenge_date, status, correct_answers AS correct_count,
       remaining_seconds, score, finished_at_utc
FROM game_sessions
WHERE finished_at_utc IS NOT NULL;
