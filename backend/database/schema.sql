CREATE DATABASE IF NOT EXISTS quintle
    CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE quintle;
CREATE TABLE IF NOT EXISTS daily_challenges (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    challenge_date DATE NOT NULL,
    category VARCHAR(100) NOT NULL,
    prompt VARCHAR(255) NOT NULL,
    time_limit INT UNSIGNED NOT NULL DEFAULT 30,
    required_answers INT UNSIGNED NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_challenge_date (challenge_date),
    UNIQUE KEY uq_challenge_id_date (id, challenge_date),
    CONSTRAINT ck_challenge_time_limit CHECK (time_limit > 0),
    CONSTRAINT ck_challenge_required_answers CHECK (required_answers > 0),
    CONSTRAINT ck_challenge_active CHECK (is_active IN (0, 1))
) ENGINE = InnoDB;
CREATE TABLE IF NOT EXISTS accepted_answers (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    challenge_id BIGINT UNSIGNED NOT NULL,
    challenge_date DATE NOT NULL,
    answer VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_answer_challenge_id (challenge_date, id),
    UNIQUE KEY uq_answer_display (challenge_id, answer),
    CONSTRAINT fk_answer_challenge FOREIGN KEY (challenge_id, challenge_date)
        REFERENCES daily_challenges (id, challenge_date)
) ENGINE = InnoDB;
CREATE TABLE IF NOT EXISTS answer_keys (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    challenge_date DATE NOT NULL,
    normalized_key VARCHAR(255) COLLATE utf8mb4_0900_bin NOT NULL,
    answer_id BIGINT UNSIGNED NOT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY uq_key_challenge (challenge_date, normalized_key),
    UNIQUE KEY uq_key_answer (answer_id, normalized_key),
    CONSTRAINT fk_answer_key_answer FOREIGN KEY (challenge_date, answer_id)
        REFERENCES accepted_answers (challenge_date, id)
) ENGINE = InnoDB;
CREATE TABLE IF NOT EXISTS players (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    token_hash BINARY(32) NOT NULL,
    display_name VARCHAR(50) DEFAULT NULL,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    last_played_at TIMESTAMP(3) NULL DEFAULT NULL,
    current_streak INT UNSIGNED NOT NULL DEFAULT 0,
    longest_streak INT UNSIGNED NOT NULL DEFAULT 0,
    last_completed_date DATE DEFAULT NULL,
    total_games INT UNSIGNED NOT NULL DEFAULT 0,
    total_score INT UNSIGNED NOT NULL DEFAULT 0,
    UNIQUE KEY uq_player_token (token_hash)
) ENGINE = InnoDB;
CREATE TABLE IF NOT EXISTS game_sessions (
    session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    player_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    challenge_id BIGINT UNSIGNED NOT NULL,
    challenge_date DATE NOT NULL,
    started_at_utc DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    expires_at DATETIME(3) GENERATED ALWAYS AS (started_at_utc + INTERVAL 30 SECOND) STORED,
    finished_at_utc DATETIME(3) DEFAULT NULL,
    status ENUM('in_progress', 'solved', 'timed_out') NOT NULL DEFAULT 'in_progress',
    correct_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    total_submissions INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    remaining_time_ms INT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status = 'solved' THEN 30000 - TIMESTAMPDIFF(MICROSECOND, started_at_utc, finished_at_utc) DIV 1000 ELSE 0 END
    ) STORED,
    -- Milisekundžių tikslumas išsaugomas iki galutinio taškų apvalinimo.
    remaining_seconds DECIMAL(5,3) UNSIGNED GENERATED ALWAYS AS (
        CASE status
            WHEN 'solved' THEN 30 - (
                TIMESTAMPDIFF(MICROSECOND, started_at_utc, finished_at_utc) / 1000000
            )
            WHEN 'timed_out' THEN 0
        END
    ) STORED,
    score SMALLINT UNSIGNED GENERATED ALWAYS AS (
        FLOOR(100 * correct_count + 10 * remaining_seconds)
    ) STORED,
    UNIQUE KEY uq_session_player_day (player_id, challenge_date),
    UNIQUE KEY uq_session_player_challenge (player_id, challenge_id),
    UNIQUE KEY uq_session_id_day (session_id, challenge_date),
    KEY ix_session_daily_score (challenge_date, score DESC),
    KEY ix_session_challenge_score (challenge_id, score DESC),
    CONSTRAINT fk_session_player FOREIGN KEY (player_id) REFERENCES players (id),
    CONSTRAINT fk_session_challenge FOREIGN KEY (challenge_date)
        REFERENCES daily_challenges (challenge_date),
    CONSTRAINT fk_session_challenge_id FOREIGN KEY (challenge_id, challenge_date)
        REFERENCES daily_challenges (id, challenge_date),
    CONSTRAINT ck_session_start_day CHECK (DATE(started_at_utc) = challenge_date),
    CONSTRAINT ck_session_state CHECK (
        (status = 'in_progress' AND finished_at_utc IS NULL AND correct_count < 5)
        OR (status = 'solved' AND correct_count = 5
            AND finished_at_utc IS NOT NULL
            AND finished_at_utc >= started_at_utc
            AND finished_at_utc < started_at_utc + INTERVAL 30 SECOND)
        OR (status = 'timed_out' AND correct_count < 5
            AND finished_at_utc IS NOT NULL
            AND finished_at_utc = started_at_utc + INTERVAL 30 SECOND)
    )
) ENGINE = InnoDB;
CREATE TABLE IF NOT EXISTS player_submissions (
    submission_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    session_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    challenge_date DATE NOT NULL,
    submitted_at_utc DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    guess VARCHAR(191) NOT NULL,
    outcome ENUM('correct', 'duplicate', 'incorrect') NOT NULL,
    answer_id BIGINT UNSIGNED DEFAULT NULL,
    credited_answer_id BIGINT UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN outcome = 'correct' THEN answer_id END
    ) STORED,
    UNIQUE KEY uq_submission_credit (session_id, credited_answer_id),
    KEY ix_submission_session_order (session_id, submission_id),
    KEY ix_submission_rarity (challenge_date, outcome, answer_id),
    CONSTRAINT fk_submission_session FOREIGN KEY (session_id, challenge_date)
        REFERENCES game_sessions (session_id, challenge_date),
    CONSTRAINT fk_submission_answer FOREIGN KEY (challenge_date, answer_id)
        REFERENCES accepted_answers (challenge_date, id),
    CONSTRAINT ck_submission_answer CHECK (
        (outcome = 'incorrect' AND answer_id IS NULL)
        OR (outcome IN ('correct', 'duplicate') AND answer_id IS NOT NULL)
    )
) ENGINE = InnoDB;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW current_challenge AS
SELECT challenge_date, category, prompt
FROM daily_challenges
WHERE challenge_date = UTC_DATE();
CREATE OR REPLACE SQL SECURITY INVOKER VIEW player_scores AS
SELECT session_id, player_id, challenge_date, status, correct_count,
       remaining_seconds, score, finished_at_utc
FROM game_sessions
WHERE finished_at_utc IS NOT NULL;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW daily_leaderboard AS
SELECT challenge_date, player_id, correct_count, remaining_seconds, score,
       DENSE_RANK() OVER (PARTITION BY challenge_date ORDER BY score DESC) AS daily_rank
FROM player_scores;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW player_streaks AS
WITH consecutive_days AS (
    SELECT player_id, challenge_date,
           DATEDIFF(challenge_date, '2000-01-01')
               - CAST(ROW_NUMBER() OVER (
                   PARTITION BY player_id ORDER BY challenge_date
               ) AS SIGNED) AS day_group
    FROM player_scores
    WHERE challenge_date <= UTC_DATE()
), streaks AS (
    SELECT player_id, COUNT(*) AS days_played, MAX(challenge_date) AS last_played_date
    FROM consecutive_days
    GROUP BY player_id, day_group
)
SELECT p.id AS player_id,
       COALESCE(MAX(CASE WHEN s.last_played_date >= UTC_DATE() - INTERVAL 1 DAY
                         THEN s.days_played END), 0) AS current_streak,
       COALESCE(MAX(s.days_played), 0) AS longest_streak,
       MAX(s.last_played_date) AS last_played_date
FROM players AS p
LEFT JOIN streaks AS s ON s.player_id = p.id
GROUP BY p.id;
CREATE OR REPLACE SQL SECURITY INVOKER VIEW answer_rarity_stats AS
WITH daily_totals AS (
    SELECT challenge_date, COUNT(*) AS finished_rounds
    FROM player_scores
    GROUP BY challenge_date
), answer_totals AS (
    SELECT g.challenge_date, s.answer_id, COUNT(*) AS credited_rounds
    FROM player_scores AS g
    JOIN player_submissions AS s ON s.session_id = g.session_id
    WHERE s.outcome = 'correct'
    GROUP BY g.challenge_date, s.answer_id
)
SELECT a.challenge_date, a.id AS answer_id, a.answer AS display_answer,
       COALESCE(t.finished_rounds, 0) AS finished_rounds,
       COALESCE(c.credited_rounds, 0) AS credited_rounds,
       ROUND(100.0 * COALESCE(c.credited_rounds, 0)
             / NULLIF(t.finished_rounds, 0), 2) AS answer_rate_percent
FROM accepted_answers AS a
LEFT JOIN daily_totals AS t ON t.challenge_date = a.challenge_date
LEFT JOIN answer_totals AS c
    ON c.challenge_date = a.challenge_date AND c.answer_id = a.id;
SHOW FULL TABLES FROM quintle;
