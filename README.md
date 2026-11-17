# Quintle

Five answers. Thirty seconds. One daily challenge.

## Install

- [Node.js 24](https://nodejs.org/) (includes npm)
- [Git](https://git-scm.com/)
- [VS Code](https://code.visualstudio.com/) (recommended)

## Stack

- Frontend: React, JavaScript, Vite, Tailwind CSS
- Backend: Node.js 24, Express, TypeScript (native Node.js type stripping)
- Database: MySQL 8.0 (schema in `backend/database/schema.sql`)

## Folders

- `frontend/`: game interface
- `backend/`: API and game logic
- `docs/mvp.md`: game requirements

## Run

Start MySQL 8.0 and import `backend/database/schema.sql`. For an existing database,
also apply `backend/database/migrations/001_precise_scoring.sql` once; `CREATE TABLE IF NOT EXISTS`
does not update existing generated columns. The migration preserves sessions and recalculates
their scores using the original timestamps.

Existing databases also need `backend/database/migrations/002_challenge_metadata.sql`
once to add challenge settings and timestamps. Fresh imports already include these fields.
These settings are stored metadata for now: gameplay still uses 30 seconds and five answers,
and the API does not yet use `is_active` to control availability.

Set the connection URL in your shell (replace the placeholders with your database settings;
URL-encode special characters in the username/password):

```powershell
$env:DATABASE_URL = 'mysql://USER:PASSWORD@HOST:PORT/quintle'
npm.cmd install
npm.cmd run dev
```

Use `npm` instead of `npm.cmd` outside Windows PowerShell.

`npm run dev` starts the API and Vite together. The API uses `PORT` (default 3001)
and `HOST` (default loopback). Vite proxies `/api` to the API; set `API_PROXY_TARGET`
only when the backend runs at a different address. No extra configuration files are required.

`npm run build` checks backend types and builds the frontend. `npm start` serves the API
and the built frontend together. `npm run preview` starts the API alongside Vite's build preview.
Set `NODE_ENV=production` when deploying over HTTPS
so the player cookie is also marked Secure.

The server identifies anonymous players through an HttpOnly cookie, stores sessions in MySQL,
validates answers and aliases, and determines elapsed time. Refreshing or restarting the API
does not restart an attempt. The existing curated categories initialize missing daily content;
database content already present is preserved.

`backend/database/seed.sql` populates 30 UTC days starting today, using three rotating
starter categories with accepted answers and aliases. Run it after `schema.sql`;
re-running it preserves existing dates and player data. Replace starter content before launch.
`.env.example` documents settings for the upcoming local container setup on port 3307.

Existing databases: stop the API, back up the database, then apply
`backend/database/migrations/003_challenge_ids.sql` once after migration 002.
It adds challenge IDs and links existing answers without replacing their IDs or dates.
Then apply `backend/database/migrations/004_answer_fields.sql` once to rename answer/key
fields, allow 255 characters, and add alias IDs and timestamps. Existing answer IDs remain valid.
Apply `backend/database/migrations/005_player_uuids.sql` next to replace numeric player IDs
with random UUIDs and preserve existing cookies, games, and scores.
Then apply `backend/database/migrations/006_player_statistics.sql` to add profile fields and
backfill totals and streaks. The API refreshes statistics from completed attempts on every request;
timeouts count as completed games. Stored current streaks update when the player returns.
Apply `backend/database/migrations/007_session_uuids.sql` next to convert session IDs and
their submission references to random UUIDs while preserving answers, scores, and deadlines.
Then apply `backend/database/migrations/008_session_details.sql` for deadlines, millisecond
time remaining, creation timestamps, and submission counts. Counts include correct, incorrect,
duplicate, and expired guesses. Deadlines and completion time remain derived from server timestamps.
Apply `backend/database/migrations/009_session_challenges.sql` next to link existing sessions
to challenge IDs, enforce one attempt per player and challenge, and index scores by challenge.
With `DATABASE_URL` set, run `node backend/database/migrations/010_submission_details.ts`
after 009, with the API stopped and a backup. It backfills Unicode-normalized guesses,
millisecond response times, and submission indexes while preserving original input.
Then apply `backend/database/migrations/011_expired_submissions.sql` to record late guesses
as expired. They count as submissions but never earn points or fill answer slots.
Apply `backend/database/migrations/012_submission_input_fields.sql` next to rename `guess`
to `submitted_text` and `submitted_at_utc` to `submitted_at`. Timestamps remain UTC;
existing input, IDs, scores, and submission indexes are preserved.
Then apply `backend/database/migrations/013_submission_identity_fields.sql` to rename
`submission_id` to `id` and `outcome` to `result`, preserving credits and rarity statistics.
Apply `backend/database/migrations/014_session_identity_field.sql` next to rename the session
primary key to `id`. Existing UUIDs, submission references, and score-view output stay the same.
Then apply `backend/database/migrations/015_session_answer_count.sql` to rename `correct_count`
to `correct_answers`, preserving stored counts, precise scoring, and session state checks.
Apply `backend/database/migrations/016_session_timestamps.sql` next to rename the session
timestamps to `started_at` and `finished_at`. Values remain UTC with millisecond precision.
Then apply `backend/database/migrations/017_session_statuses.sql` to map session states to
`active`, `completed`, and `expired`. Existing game timing, scores, and history are preserved.
Fresh imports of `schema.sql` already include these migrations; do not apply them again.
Challenge availability settings remain to be updated.

## Scoring and tests

The score is `floor(correct answers × 100 + remaining milliseconds / 1000 × 10)`.
The remaining time is limited to 0–30 seconds. A timeout has no speed bonus.
For example, five answers completed in 5.049 seconds earn 749 points. The maximum is 800.
Sample rarity remains a separate UI preview and does not affect the official score.

`npm test` runs UI and scoring tests. MySQL integration tests run when `TEST_DATABASE_URL`
identifies an isolated test database. To automatically create and remove a temporary MySQL 8.0
Docker container, run:

```powershell
npm.cmd run test:integration --workspace backend
```

The integration tests cover real HTTP requests, stored scores, precise time, late answers,
duplicates, concurrent submissions, session recovery, input validation, UTC midnight and migration.
Use an isolated database for `TEST_DATABASE_URL`: the migration test exercises the old scoring definition.

Share results copies a match link. Shared matches open without browser storage; answers stay hidden until revealed. Links use the current site address, so deploy the frontend to share beyond localhost.

Shared links contain public match details for display; they are never accepted as server submissions
or imported as another player's progress. Existing version 1 links remain supported.
