# Quintle MVP specification

## Product

**Quintle — Five answers. Thirty seconds. One daily challenge.**

A free browser trivia game requiring no account. Players name five distinct answers to one daily category. A complete visit should take less than one minute and encourage returning the next day.

## Daily game loop

1. Show today's category and challenge number before play.
2. The player presses **Start challenge**. This is the first gameplay interaction and begins a real 30-second countdown.
3. The player submits answers one at a time through a single input.
4. Correct answers fill five numbered slots. Invalid answers and duplicate canonical answers show immediate feedback without consuming slots.
5. Finish immediately after the fifth correct answer or automatically at the deadline.
6. Calculate the score, save the daily result and streak locally, and show the results and share action.
7. Unlock the next challenge at 00:00 UTC. Every player receives the same category for that UTC date.

The supplied demo layout is a visual reference. The playable MVP must use an actual countdown. An active attempt should recover its original deadline after a refresh rather than restarting the clock. A completed result should reopen as results for that UTC date.

Use the UTC date at the start of an attempt to identify its challenge. An attempt already underway at midnight may finish its original 30-second window; subsequent starts use the new UTC date.

## Validation and content

- Use manually curated categories, canonical answers, and explicit spelling variants/aliases.
- Trim input and normalize casing/whitespace before matching.
- Map aliases to one canonical answer before checking duplicates.
- Keep authoritative accepted-answer lists on the backend.
- Avoid unrestricted fuzzy matching that could accept an incorrect answer.
- Each category must support at least five distinct correct answers.
- Use a specific but achievable category, such as countries beginning with M. General countries can serve as onboarding content.
- Do not generate accepted answers with AI at runtime.

## Scoring

The interface also demonstrates rarity with explicitly labeled sample pick rates. These illustrative values are shown separately and do not affect the server-confirmed score.

**Score = (correct answers × 100) + (seconds remaining × 10).**

Use precise elapsed time rather than rounded display seconds. Clamp remaining time to the range 0–30 seconds. For an integer score, floor the final formula once. A timeout gives zero time bonus; completing five answers early gives the bonus for the actual remaining time.

- Maximum theoretical score: **800**.
- Five correct answers: **at least 500**.
- Show the score, accepted answers, and elapsed completion time on results.
- Timer updates must derive from a deadline rather than decrementing a counter; delayed frames or background tabs must not extend an attempt.
- Rarity does not affect the MVP score.

## Sharing and local progress

Share a spoiler-free summary containing the game name, challenge number/date, correct-answer count, score, and a five-slot emoji representation. Include the game link after a deployment URL exists. Do not reveal the category's answers.

Copy through the browser clipboard API and offer selectable text if copying is unavailable. Save results and streaks in localStorage. Streaks use consecutive completed UTC challenge dates; completing the same date twice must not increase the streak. Handle unavailable or malformed local storage without breaking play.

Browser-only progress is device/browser specific and may be lost when storage is cleared. No account or cross-device synchronization is included.

## Design

| Token | Value |
| --- | --- |
| Ink | `#F4F5F6` |
| Correct / accent | `#C1F26D` |
| Canvas | `#111517` |

Use large readable type, one input, five answer slots, subtle transitions, and immediate text feedback. Make keyboard submission and focus clear. Do not rely on color alone to explain validity. Keep gameplay visible on typical mobile screens with the on-screen keyboard open, and support small viewports without hiding controls.

## Storage and services

Use MySQL 8.0 with the schema in `backend/database/schema.sql`:

- `daily_challenges`, `accepted_answers`, `answer_keys`: UTC category, canonical answers, and aliases.
- `players`, `game_sessions`, `player_submissions`: anonymous identity, server timestamps, accepted answers, and generated scores.

`GET /api/game`, `POST /api/game/start` and `POST /api/game/answers` return the authoritative game state and score. An HttpOnly cookie identifies the anonymous player; client-supplied points and timestamps are rejected. Anonymous identifiers support submissions without user accounts; they do not establish a verified identity.

## MVP scope

Required: one daily UTC challenge, 30-second timer, curated answer and alias validation, five slots, deterministic scoring, results, spoiler-free sharing, and local results/streak storage.

Deferred: global rarity, user accounts, cross-device history, leaderboards, payments, and multiplayer.

## Launch acceptance criteria

- A player opens the game and plays without creating an account.
- All players receive the same category for the same UTC date.
- Start begins the real countdown; timeout ends the game automatically.
- Five distinct accepted answers end the game early.
- Invalid answers and duplicate aliases never fill another slot.
- Scoring uses precise elapsed time and respects the documented bounds.
- Results include the score, accepted answers, and completion time.
- Sharing works without revealing answers, with a fallback when clipboard access fails.
- Results survive refresh, and streak calculations handle consecutive dates and missed days.
- An active attempt cannot gain extra time by refreshing or backgrounding the page.
- The next challenge becomes available at UTC midnight.
- The game is usable with a keyboard and on mobile.
