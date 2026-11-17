-- Apply once after 006 with the API stopped and a database backup.
ALTER TABLE game_sessions ADD COLUMN session_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE game_sessions SET session_uuid = LOWER(CONCAT(
    HEX(RANDOM_BYTES(4)), '-', HEX(RANDOM_BYTES(2)), '-4', RIGHT(HEX(RANDOM_BYTES(2)), 3),
    '-', SUBSTR('89ab', 1 + (ORD(RANDOM_BYTES(1)) & 3), 1), RIGHT(HEX(RANDOM_BYTES(2)), 3),
    '-', HEX(RANDOM_BYTES(6))
));
ALTER TABLE game_sessions
    MODIFY COLUMN session_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ADD UNIQUE KEY uq_session_uuid (session_uuid);
ALTER TABLE player_submissions DROP FOREIGN KEY fk_submission_session;
ALTER TABLE player_submissions MODIFY COLUMN session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
UPDATE player_submissions s JOIN game_sessions g ON CAST(g.session_id AS CHAR(20)) = s.session_id
SET s.session_id = g.session_uuid;
ALTER TABLE game_sessions
    DROP INDEX uq_session_id_day, DROP PRIMARY KEY, DROP COLUMN session_id,
    CHANGE COLUMN session_uuid session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ADD PRIMARY KEY (session_id), DROP INDEX uq_session_uuid,
    ADD UNIQUE KEY uq_session_id_day (session_id, challenge_date);
ALTER TABLE player_submissions ADD CONSTRAINT fk_submission_session FOREIGN KEY (session_id, challenge_date)
    REFERENCES game_sessions (session_id, challenge_date);
