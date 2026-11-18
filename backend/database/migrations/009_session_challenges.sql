-- Apply once after 008 with the API stopped and a database backup.
ALTER TABLE game_sessions ADD COLUMN challenge_id BIGINT UNSIGNED NULL;
UPDATE game_sessions g JOIN daily_challenges c ON c.challenge_date = g.challenge_date
SET g.challenge_id = c.id;
ALTER TABLE game_sessions
    MODIFY COLUMN challenge_id BIGINT UNSIGNED NOT NULL,
    ADD UNIQUE KEY uq_session_player_challenge (player_id, challenge_id),
    ADD KEY ix_session_challenge_score (challenge_id, score DESC),
    ADD CONSTRAINT fk_session_challenge_id FOREIGN KEY (challenge_id, challenge_date)
        REFERENCES daily_challenges (id, challenge_date);
