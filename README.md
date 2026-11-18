# Quintle

## Install

- [Node.js 24](https://nodejs.org/) (includes npm)
- [Git](https://git-scm.com/)
- [MySQL 8.0](https://dev.mysql.com/downloads/mysql/)

## Setup and run

For a fresh database, start MySQL and run from the project folder in Windows PowerShell:

```powershell
npm.cmd install
mysql -u root -p -e "source backend/database/schema.sql"
mysql -u root -p -e "source backend/database/seed.sql"
$env:DATABASE_URL = 'mysql://root:YOUR_PASSWORD@127.0.0.1:3306/quintle'
npm.cmd run dev
```

In Git Bash, set the connection using:

```bash
export DATABASE_URL='mysql://root:YOUR_PASSWORD@127.0.0.1:3306/quintle'
```

Replace `YOUR_PASSWORD` with your MySQL password; URL-encode special characters.
For a root account with no password, use `mysql://root@127.0.0.1:3306/quintle`.
Open **http://127.0.0.1:5173**. The API runs on port **3001**.

Existing databases: stop the API, back up, then apply only pending migrations in
`backend/database/migrations/` in numeric order. With `DATABASE_URL` set, run 010 using
`node backend/database/migrations/010_submission_details.ts`. Fresh databases need no migrations.

## Build and start

With `DATABASE_URL` set in the same terminal:

```powershell
npm.cmd run build
npm.cmd start
```

Open **http://127.0.0.1:3001**. Outside Windows PowerShell, use `npm` instead of `npm.cmd`.

## Vercel

Import the repository root as one project. Set `DATABASE_URL` to a hosted MySQL URL with the schema and seed imported; Docker hostnames are local only. Keep `APP_ORIGIN` unset for same-domain previews, or set it to your exact production origin. Preserve your provider's TLS options in the URL.

Test services locally with `npx vercel dev --local` after setting `DATABASE_URL`.
