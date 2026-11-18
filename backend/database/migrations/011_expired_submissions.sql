-- Stop the API and back up the database. Apply once after migration 010.
-- Late guesses retain their raw input and timing, without validating or crediting an answer.
ALTER TABLE player_submissions DROP CHECK ck_submission_answer;
ALTER TABLE player_submissions
    MODIFY COLUMN outcome ENUM('correct', 'duplicate', 'incorrect', 'expired') NOT NULL,
    ADD CONSTRAINT ck_submission_answer CHECK (
        (outcome IN ('incorrect', 'expired') AND answer_id IS NULL)
        OR (outcome IN ('correct', 'duplicate') AND answer_id IS NOT NULL)
    );
