import crypto from 'node:crypto';

const options = parseArgs(process.argv.slice(2));
if (!options.version || !options.model) throw new Error('--version and --model are required.');
const apiUrl = String(process.env.CODEX_API_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const ollamaUrl = String(process.env.LOCAL_MODEL_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');
const serviceToken = process.env.RUNTIME_SERVICE_TOKEN;
if (!serviceToken) throw new Error('RUNTIME_SERVICE_TOKEN is required.');

const tagsResponse = await fetch(`${ollamaUrl}/api/tags`);
const tags = await tagsResponse.json();
if (!tagsResponse.ok) throw new Error(`Ollama tags failed with HTTP ${tagsResponse.status}.`);
const installed = (tags.models || []).some(item => (item.name || item.model) === options.model);
if (!installed) throw new Error(`Ollama model ${options.model} is not installed.`);
const probeResponse = await fetch(`${ollamaUrl}/api/chat`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    model: options.model, stream: false, think: false,
    messages: [{ role: 'system', content: 'Reply with exactly READY.' }, { role: 'user', content: 'Deployment probe.' }],
    options: { temperature: 0, num_predict: 8 }
  })
});
const probe = await probeResponse.json();
if (!probeResponse.ok || !String(probe.message?.content || '').trim()) throw new Error('Ollama deployment probe did not return a response.');
const report = {
  verified: true, provider: 'ollama', modelName: options.model,
  probeResponseSha256: crypto.createHash('sha256').update(String(probe.message.content)).digest('hex'),
  verifiedAt: new Date().toISOString()
};
const response = await fetch(`${apiUrl}/api/v1/local-ai/training/versions/${encodeURIComponent(options.version)}/report`, {
  method: 'POST', headers: { authorization: `Bearer ${serviceToken}`, 'content-type': 'application/json' },
  body: JSON.stringify({ phase: 'deployment', report })
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || `Deployment report failed with HTTP ${response.status}.`);
console.log(JSON.stringify(result, null, 2));

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 2) values[args[index].replace(/^--/, '')] = args[index + 1];
  return values;
}
