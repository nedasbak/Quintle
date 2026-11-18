-- Stop the API and back up the database. Apply once after migration 011.
-- Renaming preserves raw text, UTC timestamps, IDs, relationships, and indexes.
ALTER TABLE player_submissions
    RENAME COLUMN guess TO submitted_text,
    RENAME COLUMN submitted_at_utc TO submitted_at;
