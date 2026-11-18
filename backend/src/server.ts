import { fileURLToPath } from 'node:url';
import { mountFrontend } from './frontend.ts';
import { createRuntime } from './runtime.ts';

const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
const { app, pool } = await createRuntime();

// Tas pats serveris gali pateikti ir sukompiliuotą naršyklės sąsają.
const frontend = fileURLToPath(new URL('../../frontend/dist/', import.meta.url));
mountFrontend(app, frontend);
const server = app.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`Quintle API listening on port ${port}`));

// Stabdant procesą uždaromos HTTP ir duomenų bazės jungtys.
function shutdown() {
  server.close(() => { void pool.end().then(() => process.exit(0)); });
  server.closeIdleConnections();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
