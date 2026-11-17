-- Esami įrašai išsaugomi; taškai perskaičiuojami pagal tikslų pabaigos laiką.
ALTER TABLE game_sessions
    DROP INDEX ix_session_daily_score,
    DROP COLUMN score,
    DROP COLUMN remaining_seconds,
    ADD COLUMN remaining_seconds DECIMAL(5,3) UNSIGNED GENERATED ALWAYS AS (
        CASE status
            WHEN 'solved' THEN 30 - (
                TIMESTAMPDIFF(MICROSECOND, started_at_utc, finished_at_utc) / 1000000
            )
            WHEN 'timed_out' THEN 0
        END
    ) STORED,
    ADD COLUMN score SMALLINT UNSIGNED GENERATED ALWAYS AS (
        FLOOR(100 * correct_count + 10 * remaining_seconds)
    ) STORED,
    ADD INDEX ix_session_daily_score (challenge_date, score DESC);
