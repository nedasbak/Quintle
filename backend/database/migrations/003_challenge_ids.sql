-- Apply once after 002, with the API stopped. Back up the database first.
-- MySQL DDL commits separately; existing dates and answer IDs are retained.
ALTER TABLE daily_challenges
    ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST,
    ADD UNIQUE KEY uq_challenge_id_date (id, challenge_date),
    ADD UNIQUE KEY uq_challenge_date (challenge_date);
ALTER TABLE daily_challenges DROP PRIMARY KEY, ADD PRIMARY KEY (id);
ALTER TABLE accepted_answers
    ADD COLUMN challenge_id BIGINT UNSIGNED NULL AFTER answer_id,
    ADD COLUMN created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
UPDATE accepted_answers a
JOIN daily_challenges c ON c.challenge_date = a.challenge_date
SET a.challenge_id = c.id;
ALTER TABLE accepted_answers DROP FOREIGN KEY fk_answer_challenge;
ALTER TABLE accepted_answers
    DROP INDEX uq_answer_display,
    MODIFY COLUMN challenge_id BIGINT UNSIGNED NOT NULL,
    ADD UNIQUE KEY uq_answer_display (challenge_id, display_answer),
    ADD CONSTRAINT fk_answer_challenge FOREIGN KEY (challenge_id, challenge_date)
        REFERENCES daily_challenges (id, challenge_date);
