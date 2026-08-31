import { spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import { parseEnv } from 'node:util';

const backendEnvironment = readBackendEnvironment();

const pnpm = 'pnpm';
const sharedEnvironment = {
  ...process.env,
  CODEX_API_URL: process.env.CODEX_API_URL || 'http://127.0.0.1:3000',
  MIRROR_RUNTIME_PORT: process.env.MIRROR_RUNTIME_PORT || '3100',
  MIRROR_RUNTIME_URL: process.env.MIRROR_RUNTIME_URL || 'http://127.0.0.1:3100',
  ARI_RUNTIME_PORT: process.env.ARI_RUNTIME_PORT || '3300',
  ARI_RUNTIME_URL: process.env.ARI_RUNTIME_URL || 'http://127.0.0.1:3300',
  ARI_RUNTIME_CONTROL_KEY: process.env.ARI_RUNTIME_CONTROL_KEY || backendEnvironment.ARI_RUNTIME_CONTROL_KEY || process.env.RUNTIME_SERVICE_TOKEN || backendEnvironment.RUNTIME_SERVICE_TOKEN || 'mirror-platform-local',
  MIRROR_TRUST_PROXY: process.env.MIRROR_TRUST_PROXY || 'true',
  GARDEN_GATEWAY_PORT: process.env.GARDEN_GATEWAY_PORT || '3200',
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL || backendEnvironment.PUBLIC_APP_URL || 'https://acommunitygarden.garden',
  RUNTIME_SERVICE_TOKEN: process.env.RUNTIME_SERVICE_TOKEN || backendEnvironment.RUNTIME_SERVICE_TOKEN || 'mirror-platform-local',
  GARDEN_OAUTH_SECRET: process.env.GARDEN_OAUTH_SECRET || backendEnvironment.GARDEN_OAUTH_SECRET || process.env.RUNTIME_SERVICE_TOKEN || backendEnvironment.RUNTIME_SERVICE_TOKEN || 'mirror-platform-local',
  GARDEN_WEB_BOT_AUTH_SECRET: process.env.GARDEN_WEB_BOT_AUTH_SECRET || backendEnvironment.GARDEN_WEB_BOT_AUTH_SECRET || '',
  LOCAL_MODEL_URL: process.env.LOCAL_MODEL_URL || 'http://127.0.0.1:11434',
  LOCAL_MODEL_NAME: process.env.LOCAL_MODEL_NAME || 'mirror-qwen3-conversation:codex-v3',
  ALIGNMENT_MODEL_URL: process.env.ALIGNMENT_MODEL_URL || 'http://127.0.0.1:11435',
  ALIGNMENT_MODEL_DEVICE: process.env.ALIGNMENT_MODEL_DEVICE || 'cpu',
  CF_ZONE_TAG: process.env.CF_ZONE_TAG || backendEnvironment.CF_ZONE_TAG || '',
  CF_ANALYTICS_TOKEN: process.env.CF_ANALYTICS_TOKEN || backendEnvironment.CF_ANALYTICS_TOKEN || ''
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
    name: 'ari-runtime',
    command: pnpm,
    args: ['--dir', 'ari-runtime', 'dev']
  },
  {
    name: 'garden-entrance',
    command: pnpm,
    args: ['--dir', 'mirror-runtime', 'public:dev']
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
    stopChildTree(child);
  }
  setTimeout(() => process.exit(exitCode), 250);
}

function stopChildTree(child) {
  if (child.killed || child.exitCode !== null || !child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  child.kill('SIGTERM');
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

console.log('[mirror-platform] Codex API: http://127.0.0.1:3000');
console.log('[mirror-platform] ChromaBridge: http://127.0.0.1:4173');
console.log('[mirror-platform] Emotional Translator: http://127.0.0.1:3100');
console.log('[mirror-platform] Independent ARI runtime: http://127.0.0.1:3300');
console.log('[mirror-platform] Public Garden Entrance: http://127.0.0.1:3200');
console.log(`[mirror-platform] Local reasoning model: ${sharedEnvironment.LOCAL_MODEL_NAME} at ${sharedEnvironment.LOCAL_MODEL_URL}`);
console.log(`[mirror-platform] Learned alignment adapter: ${sharedEnvironment.ALIGNMENT_MODEL_URL} on ${sharedEnvironment.ALIGNMENT_MODEL_DEVICE}`);

function readBackendEnvironment() {
  try {
    return parseEnv(readFileSync(new URL('../codex/backend/.env', import.meta.url), 'utf8'));
  } catch {
    return {};
  }
}
