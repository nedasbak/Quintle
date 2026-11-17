-- Apply once after 003, with the API stopped and a database backup.
-- IDs and foreign-key relationships are preserved. DDL commits separately.
ALTER TABLE accepted_answers RENAME COLUMN answer_id TO id, ALGORITHM = INPLACE;
ALTER TABLE accepted_answers CHANGE COLUMN display_answer answer VARCHAR(255) NOT NULL;
ALTER TABLE answer_keys
    DROP PRIMARY KEY,
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST,
    CHANGE COLUMN normalized_answer normalized_key VARCHAR(255) COLLATE utf8mb4_0900_bin NOT NULL,
    ADD COLUMN created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD UNIQUE KEY uq_key_challenge (challenge_date, normalized_key),
    ADD UNIQUE KEY uq_key_answer (answer_id, normalized_key);
CREATE OR REPLACE SQL SECURITY INVOKER VIEW answer_rarity_stats AS
WITH daily_totals AS (
    SELECT challenge_date, COUNT(*) AS finished_rounds FROM player_scores GROUP BY challenge_date
), answer_totals AS (
    SELECT g.challenge_date, s.answer_id, COUNT(*) AS credited_rounds
    FROM player_scores g JOIN player_submissions s ON s.session_id = g.session_id
    WHERE s.outcome = 'correct' GROUP BY g.challenge_date, s.answer_id
)
SELECT a.challenge_date, a.id AS answer_id, a.answer AS display_answer,
       COALESCE(t.finished_rounds, 0) AS finished_rounds,
       COALESCE(c.credited_rounds, 0) AS credited_rounds,
       ROUND(100.0 * COALESCE(c.credited_rounds, 0) / NULLIF(t.finished_rounds, 0), 2) AS answer_rate_percent
FROM accepted_answers a
LEFT JOIN daily_totals t ON t.challenge_date = a.challenge_date
LEFT JOIN answer_totals c ON c.challenge_date = a.challenge_date AND c.answer_id = a.id;
