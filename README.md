# Quintle

## Install

- [Node.js 24](https://nodejs.org/) (includes npm)
- [Git](https://git-scm.com/)
- [MySQL 8.0](https://dev.mysql.com/downloads/mysql/)

## Setup and run

Start MySQL, then run from the project folder in Windows PowerShell:

```powershell
npm.cmd install
mysql -u root -p -e "source backend/database/schema.sql; source backend/database/seed.sql;"
$env:DATABASE_URL = 'mysql://root:YOUR_PASSWORD@127.0.0.1:3306/quintle'
npm.cmd run dev
```

Replace `YOUR_PASSWORD` with your MySQL password; URL-encode special characters.
Open **http://127.0.0.1:5173**. The API runs on port **3001**.

Fresh databases need no migrations. Existing databases need pending migrations in
`backend/database/migrations/`, in numeric order; run migration 010 with Node.js.

## Build and start

With `DATABASE_URL` set in the same terminal:

```powershell
npm.cmd run build
npm.cmd start
```

Open **http://127.0.0.1:3001**. Outside Windows PowerShell, use `npm` instead of `npm.cmd`.
