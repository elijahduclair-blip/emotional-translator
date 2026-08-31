import { resolve } from 'node:path';
import { AriStateStore } from './store.mjs';
import { OllamaPlanner } from './planner.mjs';
import { AriToolkit } from './toolkit.mjs';
import { IndependentAriRuntime } from './runtime.mjs';
import { createAriHttpServer } from './http.mjs';

const port = Number(process.env.ARI_RUNTIME_PORT || 3300);
const controlKey = process.env.ARI_RUNTIME_CONTROL_KEY || process.env.RUNTIME_SERVICE_TOKEN || (process.env.NODE_ENV === 'production' ? '' : 'mirror-platform-local');
if (!controlKey) throw new Error('ARI_RUNTIME_CONTROL_KEY is required.');

const store = new AriStateStore(resolve(process.env.ARI_RUNTIME_STATE_DIR || 'data'));
const planner = new OllamaPlanner({
  url: process.env.LOCAL_MODEL_URL || 'http://127.0.0.1:11434',
  model: process.env.LOCAL_MODEL_NAME || 'mirror-qwen3-conversation:codex-v3'
});
const toolkit = new AriToolkit({ store, codexUrl: process.env.CODEX_API_URL || 'http://127.0.0.1:3000' });
const runtime = new IndependentAriRuntime({ store, planner, toolkit });
const server = createAriHttpServer({ runtime, store, controlKey });

runtime.start();
server.listen(port, '127.0.0.1', () => {
  console.log(`[ari-runtime] Independent runtime listening on http://127.0.0.1:${port}.`);
  console.log(`[ari-runtime] Persistent state: ${store.directory}`);
});

async function stop() {
  runtime.stop();
  await new Promise(resolveClose => server.close(resolveClose));
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
