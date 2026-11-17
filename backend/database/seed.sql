-- Development content: three curated categories repeated across 30 UTC days.
-- Run after schema.sql. Existing challenge dates and player data are preserved.
USE quintle;
DROP TEMPORARY TABLE IF EXISTS quintle_seed_days, quintle_seed_answers;
CREATE TEMPORARY TABLE quintle_seed_days (
    challenge_date DATE PRIMARY KEY,
    template_id TINYINT UNSIGNED NOT NULL
);
CREATE TEMPORARY TABLE quintle_seed_answers (
    template_id TINYINT UNSIGNED NOT NULL,
    display_answer VARCHAR(191) NOT NULL,
    alias_key VARCHAR(191) DEFAULT NULL
);
INSERT INTO quintle_seed_answers (template_id, display_answer, alias_key) VALUES
    (0, 'Madagascar', NULL),
    (0, 'Malawi', NULL),
    (0, 'Malaysia', NULL),
    (0, 'Maldives', 'the maldives'),
    (0, 'Mali', NULL),
    (0, 'Malta', NULL),
    (0, 'Marshall Islands', 'the marshall islands'),
    (0, 'Mauritania', NULL),
    (0, 'Mauritius', NULL),
    (0, 'Mexico', NULL),
    (0, 'Micronesia', 'federated states of micronesia'),
    (0, 'Moldova', NULL),
    (0, 'Monaco', NULL),
    (0, 'Mongolia', NULL),
    (0, 'Montenegro', NULL),
    (0, 'Morocco', NULL),
    (0, 'Mozambique', NULL),
    (0, 'Myanmar', 'burma'),
    (1, 'Mercury', NULL),
    (1, 'Venus', NULL),
    (1, 'Earth', 'the earth'),
    (1, 'Mars', NULL),
    (1, 'Jupiter', NULL),
    (1, 'Saturn', NULL),
    (1, 'Uranus', NULL),
    (1, 'Neptune', NULL),
    (2, 'Argentina', NULL),
    (2, 'Bolivia', NULL),
    (2, 'Brazil', 'brasil'),
    (2, 'Chile', NULL),
    (2, 'Colombia', NULL),
    (2, 'Ecuador', NULL),
    (2, 'Guyana', NULL),
    (2, 'Paraguay', NULL),
    (2, 'Peru', NULL),
    (2, 'Suriname', 'surinam'),
    (2, 'Uruguay', NULL),
    (2, 'Venezuela', NULL);
START TRANSACTION;
INSERT INTO quintle_seed_days (challenge_date, template_id)
WITH RECURSIVE dates AS (
    SELECT UTC_DATE() AS challenge_date, 0 AS day_offset
    UNION ALL
    SELECT challenge_date + INTERVAL 1 DAY, day_offset + 1
    FROM dates WHERE day_offset < 29
)
SELECT d.challenge_date, MOD(MOD(DATEDIFF(d.challenge_date, '2026-11-17'), 3) + 3, 3)
FROM dates d
WHERE NOT EXISTS (SELECT 1 FROM daily_challenges c WHERE c.challenge_date = d.challenge_date);
INSERT INTO daily_challenges (challenge_date, category, prompt)
SELECT challenge_date,
       CASE template_id WHEN 1 THEN 'Space' ELSE 'Geography' END,
       CASE template_id
           WHEN 0 THEN 'Name 5 countries beginning with M'
           WHEN 1 THEN 'Name 5 planets in our solar system'
           WHEN 2 THEN 'Name 5 countries in South America'
       END
FROM quintle_seed_days;
INSERT INTO accepted_answers (challenge_date, display_answer)
SELECT d.challenge_date, a.display_answer
FROM quintle_seed_days d JOIN quintle_seed_answers a ON a.template_id = d.template_id;
INSERT INTO answer_keys (challenge_date, normalized_answer, answer_id)
SELECT a.challenge_date, LOWER(a.display_answer), a.answer_id
FROM accepted_answers a JOIN quintle_seed_days d ON d.challenge_date = a.challenge_date;
INSERT INTO answer_keys (challenge_date, normalized_answer, answer_id)
SELECT a.challenge_date, s.alias_key, a.answer_id
FROM quintle_seed_answers s
JOIN quintle_seed_days d ON d.template_id = s.template_id
JOIN accepted_answers a ON a.challenge_date = d.challenge_date AND a.display_answer = s.display_answer
WHERE s.alias_key IS NOT NULL;
COMMIT;
DROP TEMPORARY TABLE quintle_seed_days, quintle_seed_answers;
