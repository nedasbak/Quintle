-- Stop the API and back up the database. Apply once after migration 013.
-- The UUIDs, submission foreign keys, indexes, and score-view output remain intact.
ALTER TABLE player_submissions DROP FOREIGN KEY fk_submission_session;
ALTER TABLE game_sessions RENAME COLUMN session_id TO id;
ALTER TABLE player_submissions ADD CONSTRAINT fk_submission_session FOREIGN KEY (session_id, challenge_date)
    REFERENCES game_sessions (id, challenge_date);
CREATE OR REPLACE SQL SECURITY INVOKER VIEW player_scores AS
SELECT id AS session_id, player_id, challenge_date, status, correct_count,
       remaining_seconds, score, finished_at_utc
FROM game_sessions
WHERE finished_at_utc IS NOT NULL;
