import { copyFileSync, existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';
const shell = isWindows;

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell, ...options });
  if (result.error) {
    throw new Error(`Could not run ${command}. Is it installed and available on your PATH?`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} exited with code ${result.status ?? 'unknown'}.`);
  }
}

function ensureEnvFile(target) {
  if (existsSync(target)) return;
  copyFileSync('.env.example', target);
  console.log(`Created ${target} from .env.example.`);
}

async function waitForPostgres() {
  const deadline = Date.now() + 60_000;
  process.stdout.write('Waiting for PostgreSQL');

  while (Date.now() < deadline) {
    const check = spawnSync(
      'docker',
      ['compose', 'exec', '-T', 'postgres', 'pg_isready', '-U', 'splitsmart'],
      {
        stdio: 'ignore',
        shell,
      },
    );
    if (check.status === 0) {
      console.log(' ready.');
      return;
    }
    process.stdout.write('.');
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error(
    'PostgreSQL did not become ready within 60 seconds. Check Docker Desktop and try again.',
  );
}

function start(name, args) {
  const child = spawn('pnpm', args, { stdio: 'inherit', shell });
  child.on('error', (error) => console.error(`${name} failed to start: ${error.message}`));
  return child;
}

try {
  if (!existsSync('node_modules')) {
    throw new Error(
      'Dependencies are not installed. Run "pnpm install" once, then run "pnpm dev:local".',
    );
  }

  ensureEnvFile('.env');
  ensureEnvFile('apps/api/.env');

  run('docker', ['compose', 'up', '-d']);
  await waitForPostgres();
  run('pnpm', ['--filter', '@splitsmart/api', 'prisma:generate']);
  run('pnpm', ['--filter', '@splitsmart/api', 'prisma:deploy']);

  console.log('\nStarting SplitSmart: web http://localhost:3000 · API http://localhost:3001');
  const services = [
    start('auth', ['--filter', '@splitsmart/api', 'dev:auth']),
    start('api', ['--filter', '@splitsmart/api', 'dev']),
    start('web', ['--filter', '@splitsmart/web', 'dev']),
  ];

  const stop = () => {
    for (const service of services) service.kill('SIGINT');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await Promise.all(
    services.map((service) => new Promise((resolve) => service.once('exit', resolve))),
  );
} catch (error) {
  console.error(`\nUnable to start SplitSmart: ${error.message}`);
  process.exitCode = 1;
}
