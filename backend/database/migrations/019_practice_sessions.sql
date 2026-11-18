-- Apply after 018. Practice rounds do not change daily results or streaks.
USE quintle;
CREATE TABLE IF NOT EXISTS practice_sessions (
    id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    player_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    challenge_key VARCHAR(80) NOT NULL,
    theme VARCHAR(40) NOT NULL,
    category VARCHAR(100) NOT NULL,
    prompt VARCHAR(255) NOT NULL,
    answer_keys JSON NOT NULL,
    answers JSON NOT NULL DEFAULT (JSON_ARRAY()),
    started_at DATETIME(3) NOT NULL,
    expires_at DATETIME(3) GENERATED ALWAYS AS (started_at + INTERVAL 30 SECOND) STORED,
    finished_at DATETIME(3) DEFAULT NULL,
    status ENUM('active', 'completed', 'expired') NOT NULL DEFAULT 'active',
    correct_answers TINYINT UNSIGNED GENERATED ALWAYS AS (JSON_LENGTH(answers)) STORED,
    remaining_seconds DECIMAL(5,3) UNSIGNED GENERATED ALWAYS AS (
        CASE WHEN status = 'completed' THEN 30 - TIMESTAMPDIFF(MICROSECOND, started_at, finished_at) / 1000000 ELSE 0 END
    ) STORED,
    score SMALLINT UNSIGNED GENERATED ALWAYS AS (FLOOR(100 * correct_answers + 10 * remaining_seconds)) STORED,
    active_player_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (
        CASE WHEN status = 'active' THEN player_id ELSE NULL END
    ) STORED,
    UNIQUE KEY uq_practice_active_player (active_player_id),
    KEY ix_practice_history (player_id, started_at DESC, id),
    CONSTRAINT fk_practice_player FOREIGN KEY (player_id) REFERENCES players (id),
    CONSTRAINT ck_practice_catalog CHECK (JSON_TYPE(answer_keys) = 'ARRAY' AND JSON_LENGTH(answer_keys) >= 5),
    CONSTRAINT ck_practice_answers CHECK (JSON_TYPE(answers) = 'ARRAY' AND JSON_LENGTH(answers) <= 5),
    CONSTRAINT ck_practice_state CHECK (
        (status = 'active' AND finished_at IS NULL AND correct_answers < 5)
        OR (status = 'completed' AND correct_answers = 5 AND finished_at IS NOT NULL
            AND finished_at >= started_at AND finished_at < expires_at)
        OR (status = 'expired' AND correct_answers < 5 AND finished_at IS NOT NULL AND finished_at = expires_at)
    )
) ENGINE = InnoDB;
