-- Stop the API and back up the database. Apply once after migration 017.
-- The MVP supports 30 seconds and five answers; existing challenge data is retained.
CREATE OR REPLACE SQL SECURITY INVOKER VIEW current_challenge AS
SELECT challenge_date, category, prompt
FROM daily_challenges
WHERE challenge_date = UTC_DATE() AND is_active = TRUE AND time_limit = 30 AND required_answers = 5;
