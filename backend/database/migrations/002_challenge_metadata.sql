-- Apply once to an existing database. Fresh schema.sql includes these fields.
-- Existing dates, answers, players, submissions, and sessions are retained.
ALTER TABLE daily_challenges
    ADD COLUMN time_limit INT UNSIGNED NOT NULL DEFAULT 30,
    ADD COLUMN required_answers INT UNSIGNED NOT NULL DEFAULT 5,
    ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    ADD CONSTRAINT ck_challenge_time_limit CHECK (time_limit > 0),
    ADD CONSTRAINT ck_challenge_required_answers CHECK (required_answers > 0),
    ADD CONSTRAINT ck_challenge_active CHECK (is_active IN (0, 1));
