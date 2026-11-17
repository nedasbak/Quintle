import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'mysql2/promise';

const root = fileURLToPath(new URL('../../', import.meta.url));
const name = `quintle-scoring-test-${randomBytes(6).toString('hex')}`;
const password = randomBytes(24).toString('hex');

// Izoliuota MySQL bazė naudoja atsitiktinį slaptažodį ir neliečia esamų duomenų.
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, env: { ...process.env, MYSQL_ROOT_PASSWORD: password }, ...options });
    let output = '';
    child.stdout?.on('data', chunk => { output += chunk; });
    child.stderr?.on('data', chunk => process.stderr.write(chunk));
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(`${command} exited with code ${code}`)));
  });
}
let created = false;
try {
  await run('docker', ['run', '--detach', '--rm', '--name', name, '--publish', '127.0.0.1::3306', '--env', 'MYSQL_ROOT_PASSWORD', '--env', 'MYSQL_ROOT_HOST=%', 'mysql:8.0']);
  created = true;
  const address = await run('docker', ['port', name, '3306/tcp']);
  const port = Number(address.split(':').at(-1));
  const options = { host: '127.0.0.1', port, user: 'root', password, timezone: 'Z', multipleStatements: true };
  const deadline = Date.now() + 90_000;
  let connection;
  while (!connection) {
    try { connection = await createConnection(options); }
    catch (error) {
      if (Date.now() >= deadline) throw new Error('Temporary MySQL did not become ready.', { cause: error });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  await connection.query(await readFile(new URL('../database/schema.sql', import.meta.url), 'utf8'));
  await connection.end();
  console.log('Running integration tests against isolated MySQL 8.0.');
  await run(process.execPath, ['--test', 'backend/tests/api.test.ts'], {
    stdio: 'inherit', env: { ...process.env, TEST_DATABASE_URL: `mysql://root:${password}@127.0.0.1:${port}/quintle` },
  });
} finally {
  // Testų konteineris pašalinamas ir po nepavykusio patikrinimo.
  if (created) await run('docker', ['stop', name]);
}
