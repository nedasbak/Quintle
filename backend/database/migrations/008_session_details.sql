-- Apply once after 007 with the API stopped and a database backup.
SET @quintle_previous_time_zone = @@session.time_zone;
SET time_zone = '+00:00';
ALTER TABLE game_sessions
    ADD COLUMN expires_at DATETIME(3) GENERATED ALWAYS AS (started_at_utc + INTERVAL 30 SECOND) STORED,
    ADD COLUMN total_submissions INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN created_at TIMESTAMP(3) NULL DEFAULT NULL,
    ADD COLUMN remaining_time_ms INT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status = 'solved' THEN 30000 - TIMESTAMPDIFF(MICROSECOND, started_at_utc, finished_at_utc) DIV 1000 ELSE 0 END
    ) STORED;
UPDATE game_sessions g LEFT JOIN (
    SELECT session_id, COUNT(*) AS total FROM player_submissions GROUP BY session_id
) s ON s.session_id = g.session_id
SET g.total_submissions = COALESCE(s.total, 0), g.created_at = g.started_at_utc;
ALTER TABLE game_sessions MODIFY COLUMN created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
SET time_zone = @quintle_previous_time_zone;
