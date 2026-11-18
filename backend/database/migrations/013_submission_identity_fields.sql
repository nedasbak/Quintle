-- Stop the API and back up the database. Apply once after migration 012.
-- Rebuild dependent credits and checks around the rename; submission IDs remain unchanged.
ALTER TABLE player_submissions
    DROP CHECK ck_submission_answer, DROP INDEX uq_submission_credit, DROP COLUMN credited_answer_id;
ALTER TABLE player_submissions
    RENAME COLUMN submission_id TO id,
    RENAME COLUMN outcome TO result;
ALTER TABLE player_submissions
    ADD COLUMN credited_answer_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN result = 'correct' THEN answer_id END) STORED,
    ADD UNIQUE KEY uq_submission_credit (session_id, credited_answer_id),
    ADD CONSTRAINT ck_submission_answer CHECK (
        (result IN ('incorrect', 'expired') AND answer_id IS NULL)
        OR (result IN ('correct', 'duplicate') AND answer_id IS NOT NULL)
    );
CREATE OR REPLACE SQL SECURITY INVOKER VIEW answer_rarity_stats AS
WITH daily_totals AS (
    SELECT challenge_date, COUNT(*) AS finished_rounds FROM player_scores GROUP BY challenge_date
), answer_totals AS (
    SELECT g.challenge_date, s.answer_id, COUNT(*) AS credited_rounds
    FROM player_scores g JOIN player_submissions s ON s.session_id = g.session_id
    WHERE s.result = 'correct' GROUP BY g.challenge_date, s.answer_id
)
SELECT a.challenge_date, a.id AS answer_id, a.answer AS display_answer,
       COALESCE(t.finished_rounds, 0) AS finished_rounds,
       COALESCE(c.credited_rounds, 0) AS credited_rounds,
       ROUND(100.0 * COALESCE(c.credited_rounds, 0) / NULLIF(t.finished_rounds, 0), 2) AS answer_rate_percent
FROM accepted_answers a
LEFT JOIN daily_totals t ON t.challenge_date = a.challenge_date
LEFT JOIN answer_totals c ON c.challenge_date = a.challenge_date AND c.answer_id = a.id;
