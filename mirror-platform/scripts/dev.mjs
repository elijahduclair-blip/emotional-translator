import { spawn } from 'node:child_process';
import process from 'node:process';

const pnpm = 'pnpm';
const sharedEnvironment = {
  ...process.env,
  CODEX_API_URL: process.env.CODEX_API_URL || 'http://127.0.0.1:3000',
  MIRROR_RUNTIME_PORT: process.env.MIRROR_RUNTIME_PORT || '3100',
  RUNTIME_SERVICE_TOKEN: process.env.RUNTIME_SERVICE_TOKEN || 'mirror-platform-local'
};

const services = [
  {
    name: 'codex',
    args: ['--dir', 'codex/backend', 'dev']
  },
  {
    name: 'chromabridge',
    args: ['--dir', 'chromabridge', 'dev', '--', '--host', '127.0.0.1', '--port', '4173']
  },
  {
    name: 'mirror-runtime',
    args: ['--dir', 'mirror-runtime', 'dev']
  }
];

let stopping = false;

function start(name, args) {
  const child = spawn(pnpm, args, {
    env: sharedEnvironment,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });

  child.stdout.on('data', chunk => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', chunk => process.stderr.write(`[${name}] ${chunk}`));
  child.on('error', error => {
    console.error(`[mirror-platform] Failed to start ${name}:`, error);
    if (!stopping) stop(1);
  });
  child.on('exit', code => {
    if (!stopping && code !== 0) {
      console.error(`[mirror-platform] ${name} stopped with exit code ${code}.`);
      stop(code || 1);
    }
  });

  return child;
}

const children = services.map(({ name, args }) => {
  return start(name, args);
});

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 250);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.log('[mirror-platform] Codex API: http://127.0.0.1:3000');
console.log('[mirror-platform] ChromaBridge: http://127.0.0.1:4173');
console.log('[mirror-platform] Emotional Translator: http://127.0.0.1:3100');
