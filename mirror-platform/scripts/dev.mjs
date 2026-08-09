import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { parseEnv } from 'node:util';

const backendEnvironment = readBackendEnvironment();

const pnpm = 'pnpm';
const sharedEnvironment = {
  ...process.env,
  CODEX_API_URL: process.env.CODEX_API_URL || 'http://127.0.0.1:3000',
  MIRROR_RUNTIME_PORT: process.env.MIRROR_RUNTIME_PORT || '3100',
  RUNTIME_SERVICE_TOKEN: process.env.RUNTIME_SERVICE_TOKEN || backendEnvironment.RUNTIME_SERVICE_TOKEN || 'mirror-platform-local',
  LOCAL_MODEL_URL: process.env.LOCAL_MODEL_URL || 'http://127.0.0.1:11434',
  LOCAL_MODEL_NAME: process.env.LOCAL_MODEL_NAME || 'qwen3:4b-instruct',
  ALIGNMENT_MODEL_URL: process.env.ALIGNMENT_MODEL_URL || 'http://127.0.0.1:11435',
  ALIGNMENT_MODEL_DEVICE: process.env.ALIGNMENT_MODEL_DEVICE || 'cpu'
};

const python = process.platform === 'win32'
  ? 'training\\.venv\\Scripts\\python.exe'
  : 'training/.venv/bin/python';

const services = [
  {
    name: 'codex',
    command: pnpm,
    args: ['--dir', 'codex/backend', 'dev']
  },
  {
    name: 'chromabridge',
    command: pnpm,
    args: ['--dir', 'chromabridge', 'dev', '--host', '127.0.0.1', '--port', '4173']
  },
  {
    name: 'mirror-runtime',
    command: pnpm,
    args: ['--dir', 'mirror-runtime', 'dev']
  },
  {
    name: 'alignment-model',
    command: python,
    args: ['training/serve_adapter.py']
  }
];

let stopping = false;

function start(name, command, args) {
  const child = spawn(command, args, {
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

const children = services.map(({ name, command, args }) => {
  return start(name, command, args);
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
console.log(`[mirror-platform] Local reasoning model: ${sharedEnvironment.LOCAL_MODEL_NAME} at ${sharedEnvironment.LOCAL_MODEL_URL}`);
console.log(`[mirror-platform] Learned alignment adapter: ${sharedEnvironment.ALIGNMENT_MODEL_URL} on ${sharedEnvironment.ALIGNMENT_MODEL_DEVICE}`);

function readBackendEnvironment() {
  try {
    return parseEnv(readFileSync(new URL('../codex/backend/.env', import.meta.url), 'utf8'));
  } catch {
    return {};
  }
}
