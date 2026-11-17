# Quintle

**Five answers. Thirty seconds. One daily challenge.**

Quintle is a free daily browser trivia game. Players have 30 seconds to submit five different correct answers to a curated category. Everyone receives the same challenge for the current UTC day.

## Project status

This repository contains the folder structure and planning documentation only. Application code, package manifests, dependency installation, build configuration, database setup, and deployment will be added when development begins. There are no runnable application commands yet.

## Stack

| Area | Planned tool | Purpose |
| --- | --- | --- |
| Frontend | React + TypeScript | Game interface, countdown, results, and local progress |
| Frontend tooling | Vite | Development server and production build |
| Styling | Tailwind CSS with its Vite plugin | Responsive layout and visual styling |
| Backend | Node.js + Express 5 + TypeScript | Daily challenge API, answer validation, and scoring |
| Package management | npm workspaces | Manage frontend and backend from one repository |
| Initial challenge storage | Curated files in the backend | Fixed daily categories, canonical answers, and aliases |
| Player progress | Browser localStorage | Daily results and streaks without accounts |
| Database, when needed | Supabase PostgreSQL | Published challenges and anonymous submissions |
| Hosting, before launch | Vercel for the frontend; Node-compatible hosting for the API | Choose and configure the API host during implementation |
| Analytics, optional | Plausible or PostHog | Choose one before launch |

The frontend will use React with Vite and the backend will use Express, following the current stack decision. Next.js is not part of this setup.

## Repository structure

```text
Quintle/
|-- frontend/
|   |-- public/                  Static assets served directly
|   |-- src/
|   |   |-- components/          Reusable interface elements
|   |   |-- features/
|   |   |   `-- game/            Challenge, answer entry, slots, and results
|   |   |-- hooks/               Reusable React hooks
|   |   |-- lib/                 API client, local storage, and browser helpers
|   |   |-- styles/              Global styles and design tokens
|   |   `-- types/               Frontend TypeScript types
|   `-- tests/                  Frontend behavior tests
|-- backend/
|   |-- src/
|   |   |-- config/             Environment and application settings
|   |   |-- controllers/        HTTP request and response handling
|   |   |-- data/
|   |   |   `-- challenges/     Curated challenges and private answer lists
|   |   |-- middleware/         Validation, errors, and request limits
|   |   |-- routes/             Express API endpoints
|   |   |-- services/           Daily selection, validation, and scoring
|   |   `-- types/              Backend TypeScript types
|   `-- tests/                  API and game rule tests
|-- docs/
|   `-- mvp.md                  Product rules and launch acceptance criteria
|-- .editorconfig               Basic editor formatting defaults
|-- .gitignore                  Dependency, build, and secret exclusions
|-- .nvmrc                      Node major version for compatible managers
`-- README.md
```

Empty folders contain `.gitkeep` files so Git preserves them. Remove each placeholder when adding real files to its folder. The two applications will remain separate npm workspaces with one root lockfile. No shared package is needed initially; private answer lists must stay in the backend.

## Tools to have installed

- **Node.js 24.x**, with npm. Use the same Node major version locally and on the API host. The `.nvmrc` file records `24` for version managers that support it.
- **Git**, connected to this repository: <https://github.com/nedasbak/Quintle>.
- **A code editor**, such as VS Code. Recommended extensions: ESLint, Prettier, and Tailwind CSS IntelliSense.
- **A modern browser** with developer tools. Check both desktop and mobile layouts during development.

Before deployment, we will also need hosting accounts. A Supabase account is only needed when database persistence is introduced. No authentication provider is required for the MVP.

Check the local tools in PowerShell:

```powershell
node --version
npm.cmd --version
git --version
```

On this Windows machine, `npm.cmd` works while `npm` resolves to a PowerShell script blocked by the execution policy. Use `npm.cmd` in PowerShell without changing that policy. On other systems, use `npm` in the commands below.

## Planned libraries

These are the packages to install when implementation starts; none are installed yet. Development tools belong in `devDependencies`. Exact resolved versions will be recorded in the root `package-lock.json` when installation happens.

| Location | Packages | Purpose |
| --- | --- | --- |
| Frontend runtime | `react`, `react-dom` | Render the game |
| Frontend development | `vite`, `@vitejs/plugin-react`, `@types/react`, `@types/react-dom` | React build tooling and types |
| Frontend styling | `tailwindcss`, `@tailwindcss/vite` | Tailwind through the Vite plugin |
| Backend runtime | `express@5`, `cors`, `helmet`, `express-rate-limit`, `zod` | API, permitted browser origins, HTTP headers, request limits, and input validation |
| Backend development | `tsx`, `@types/node`, `@types/express@5`, `@types/cors` | TypeScript development execution and server types |
| Root development | `typescript`, `concurrently` | Type checking/builds and running both apps locally |
| Root formatting/linting | `eslint`, `@eslint/js`, `typescript-eslint`, `globals`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `prettier` | Consistent code checks and formatting |
| Root testing | `vitest` | Game logic and unit tests |
| Frontend testing | `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom` | Test interactions and accessible UI behavior |
| Backend testing | `supertest`, `@types/supertest` | Test HTTP endpoints |

Use native browser `fetch`, Clipboard APIs, and localStorage for the MVP. A router, global state library, date library, animation package, and Axios are not required for the initial single-screen game.

Add `@supabase/supabase-js` to the **backend** when connecting Supabase. Add the selected analytics integration only when we decide which service to use. End-to-end browser tooling such as Playwright can be added when there is a playable flow to test.

## Installation plan for the development phase

**Reference only: these commands have not been run.** They initialize package manifests and install dependencies, so run them only when we begin implementation. They do not create a working application by themselves.

From the repository root in PowerShell, initialize the workspaces:

```powershell
npm.cmd init --yes
npm.cmd pkg set private=true --json
npm.cmd init --workspace frontend --yes
npm.cmd init --workspace backend --yes
npm.cmd pkg set private=true --json --workspace frontend --workspace backend
npm.cmd pkg set type=module --workspace frontend --workspace backend
```

Install the planned packages:

```powershell
npm.cmd install react react-dom --workspace frontend
npm.cmd install -D vite @vitejs/plugin-react @types/react @types/react-dom tailwindcss @tailwindcss/vite --workspace frontend
npm.cmd install express@5 cors helmet express-rate-limit zod --workspace backend
npm.cmd install -D tsx @types/node @types/express@5 @types/cors --workspace backend
npm.cmd install -D typescript concurrently eslint @eslint/js typescript-eslint globals eslint-plugin-react-hooks eslint-plugin-react-refresh prettier vitest
npm.cmd install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom --workspace frontend
npm.cmd install -D supertest @types/supertest --workspace backend
```

Afterward, implementation must add the React and Express entry points, TypeScript settings, Vite/Tailwind configuration, lint/test configuration, and package scripts. Use the Tailwind Vite integration documented below.

The intended root commands are `npm run dev`, `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm test`. **These scripts do not exist yet.** The development command will start both apps together. Commit the generated root `package-lock.json`; subsequent fresh checkouts will use `npm ci`.

## Environment plan

Create per-app `.env.example` files with placeholders when the applications begin using configuration. Actual `.env` files stay out of Git.

| Application | Planned variable | Purpose |
| --- | --- | --- |
| Frontend | `VITE_API_BASE_URL` | Public API address, initially `http://localhost:3001/api` |
| Backend | `PORT` | API port, initially `3001` |
| Backend | `FRONTEND_ORIGIN` | Allowed frontend origin, initially `http://localhost:5173` |
| Backend | `NODE_ENV` | Runtime environment |
| Backend, later | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Database connection and private server credential |

Vite exposes variables prefixed with `VITE_` to the browser. Keep Supabase server credentials and authoritative answer lists on the backend. Node's built-in environment-file support can load backend configuration; a separate `dotenv` dependency is not planned initially.

## Development responsibilities

- **Frontend:** start interaction, visible countdown, answer entry, five slots, feedback, results, sharing, and locally saved progress.
- **Backend:** UTC challenge selection, canonical answers and aliases, duplicate detection, and game scoring. Return only public challenge metadata before play. Design the start/answer/end API before implementation; if scores are server verified, the server must own the start timestamp and deadline.
- **Content:** use manually reviewed categories with at least five distinct valid canonical answers. Accept aliases without counting the same answer twice.
- **Verification:** test UTC rollover, deadline behavior, duplicate aliases, invalid answers, exact score calculation, reload recovery, local streaks, and clipboard fallback. Test the full game on mobile before launch.

See [the MVP specification](docs/mvp.md) for gameplay details and the definition of done.

## Official setup references

- [Vite guide](https://vite.dev/guide/) — React/TypeScript tooling and Node compatibility.
- [Express installation](https://expressjs.com/en/5x/starter/installing/) — Express and TypeScript setup.
- [Tailwind with Vite](https://tailwindcss.com/docs/installation/using-vite) — styling integration.
- [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces/) — managing both applications in one repository.
