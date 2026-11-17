# Quintle

Five answers. Thirty seconds. One daily challenge.

## Install

- [Node.js 24](https://nodejs.org/) (includes npm)
- [Git](https://git-scm.com/)
- [VS Code](https://code.visualstudio.com/) (recommended)

## Planned stack

- Frontend: React, JavaScript, Vite, Tailwind CSS
- Backend: Node.js, Express, TypeScript
- Database: Supabase (later)

## Folders

- `frontend/`: game interface
- `backend/`: API and game logic
- `docs/mvp.md`: game requirements

## Run

```powershell
npm.cmd install
npm.cmd run dev
```

Use `npm` instead of `npm.cmd` outside Windows PowerShell.

`npm run build` builds the frontend. `npm test` runs the tests.

The game UI runs locally with sample challenges and browser-saved progress. Express and server validation will be added later.

Rarity bonuses use sample pick rates for the frontend preview, not real player data.
