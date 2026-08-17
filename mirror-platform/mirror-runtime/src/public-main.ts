import { createGardenPublicGateway } from './public-gateway';

const port = Number(process.env.GARDEN_GATEWAY_PORT || 3200);
const host = '127.0.0.1';
const server = createGardenPublicGateway({
  runtimeOrigin: process.env.MIRROR_RUNTIME_URL || 'http://127.0.0.1:3100',
  trustProxy: process.env.GARDEN_GATEWAY_TRUST_PROXY === 'true',
  oauthSecret: process.env.GARDEN_OAUTH_SECRET || process.env.RUNTIME_SERVICE_TOKEN,
  webBotAuthSecret: process.env.GARDEN_WEB_BOT_AUTH_SECRET
});

server.listen(port, host, () => {
  console.log(`Garden Entrance gateway listening on http://${host}:${port}.`);
});

const stop = () => server.close(() => process.exit(0));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
