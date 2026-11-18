-- Apply once after 004 with the API stopped and a database backup.
-- Keep token hashes so existing anonymous cookies retain their history.
ALTER TABLE players ADD COLUMN id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL FIRST;
UPDATE players SET id = LOWER(CONCAT(
    HEX(RANDOM_BYTES(4)), '-', HEX(RANDOM_BYTES(2)), '-4', RIGHT(HEX(RANDOM_BYTES(2)), 3),
    '-', SUBSTR('89ab', 1 + (ORD(RANDOM_BYTES(1)) & 3), 1), RIGHT(HEX(RANDOM_BYTES(2)), 3),
    '-', HEX(RANDOM_BYTES(6))
));
ALTER TABLE players
    MODIFY COLUMN id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ADD UNIQUE KEY uq_player_uuid (id);
ALTER TABLE game_sessions ADD COLUMN player_uuid CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;
UPDATE game_sessions g JOIN players p ON p.player_id = g.player_id SET g.player_uuid = p.id;
ALTER TABLE game_sessions DROP FOREIGN KEY fk_session_player;
ALTER TABLE game_sessions
    DROP INDEX uq_session_player_day, DROP COLUMN player_id,
    CHANGE COLUMN player_uuid player_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    ADD UNIQUE KEY uq_session_player_day (player_id, challenge_date);
ALTER TABLE players DROP PRIMARY KEY, DROP COLUMN player_id, ADD PRIMARY KEY (id), DROP INDEX uq_player_uuid;
ALTER TABLE game_sessions ADD CONSTRAINT fk_session_player FOREIGN KEY (player_id) REFERENCES players (id);
CREATE OR REPLACE SQL SECURITY INVOKER VIEW player_streaks AS
WITH consecutive_days AS (
    SELECT player_id, challenge_date,
           DATEDIFF(challenge_date, '2000-01-01') - CAST(ROW_NUMBER() OVER (
               PARTITION BY player_id ORDER BY challenge_date) AS SIGNED) AS day_group
    FROM player_scores WHERE challenge_date <= UTC_DATE()
), streaks AS (
    SELECT player_id, COUNT(*) AS days_played, MAX(challenge_date) AS last_played_date
    FROM consecutive_days GROUP BY player_id, day_group
)
SELECT p.id AS player_id,
       COALESCE(MAX(CASE WHEN s.last_played_date >= UTC_DATE() - INTERVAL 1 DAY THEN s.days_played END), 0) AS current_streak,
       COALESCE(MAX(s.days_played), 0) AS longest_streak, MAX(s.last_played_date) AS last_played_date
FROM players p LEFT JOIN streaks s ON s.player_id = p.id GROUP BY p.id;
