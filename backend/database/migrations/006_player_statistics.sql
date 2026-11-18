-- Apply once after 005 with the API stopped and a database backup.
SET @quintle_previous_time_zone = @@session.time_zone;
SET time_zone = '+00:00';
ALTER TABLE players
    CHANGE COLUMN created_at_utc created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN display_name VARCHAR(50) DEFAULT NULL,
    ADD COLUMN last_played_at TIMESTAMP(3) NULL DEFAULT NULL,
    ADD COLUMN current_streak INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN longest_streak INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN last_completed_date DATE DEFAULT NULL,
    ADD COLUMN total_games INT UNSIGNED NOT NULL DEFAULT 0,
    ADD COLUMN total_score INT UNSIGNED NOT NULL DEFAULT 0;
CREATE TEMPORARY TABLE quintle_player_stats AS
SELECT p.id, s.current_streak, s.longest_streak, h.last_completed_date,
       COALESCE(h.total_games, 0) AS total_games, COALESCE(h.total_score, 0) AS total_score, a.last_played_at
FROM players p JOIN player_streaks s ON s.player_id = p.id
LEFT JOIN (
    SELECT player_id, COUNT(*) AS total_games, SUM(score) AS total_score, MAX(challenge_date) AS last_completed_date
    FROM player_scores WHERE challenge_date <= UTC_DATE() GROUP BY player_id
) h ON h.player_id = p.id
LEFT JOIN (
    SELECT g.player_id, MAX(GREATEST(g.started_at_utc, COALESCE(a.submitted_at_utc, g.started_at_utc))) AS last_played_at
    FROM game_sessions g LEFT JOIN player_submissions a ON a.session_id = g.session_id GROUP BY g.player_id
) a ON a.player_id = p.id;
UPDATE players p JOIN quintle_player_stats s ON s.id = p.id
SET p.current_streak = s.current_streak, p.longest_streak = s.longest_streak,
    p.last_completed_date = s.last_completed_date, p.total_games = s.total_games,
    p.total_score = s.total_score, p.last_played_at = s.last_played_at;
DROP TEMPORARY TABLE quintle_player_stats;
SET time_zone = @quintle_previous_time_zone;
