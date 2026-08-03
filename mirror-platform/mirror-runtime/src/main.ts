import { MirrorRuntimeService } from './services/mirror-runtime.service';
import { createMirrorHttpServer } from './http';

async function main() {
  const service = new MirrorRuntimeService({
    userId: 'system-default',
    enablePersistence: process.env.MIRROR_ENABLE_PERSISTENCE !== 'false',
    enableCodexGraphRead: process.env.MIRROR_ENABLE_CODEX_GRAPH_READ !== 'false',
    enableLocalModel: process.env.MIRROR_ENABLE_LOCAL_MODEL !== 'false',
    codexServiceToken: process.env.RUNTIME_SERVICE_TOKEN || (process.env.NODE_ENV === 'production' ? '' : 'mirror-platform-local'),
    localModelUrl: process.env.LOCAL_MODEL_URL || 'http://127.0.0.1:11434',
    localModelName: process.env.LOCAL_MODEL_NAME || 'qwen3:4b-instruct'
  });
  const port = Number(process.env.MIRROR_RUNTIME_PORT || 3100);
  const server = createMirrorHttpServer(service);

  const startService = async () => {
    try {
      await service.start();
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', () => resolve());
      });
      console.log(`MirrorRuntime service listening on http://127.0.0.1:${port}.`);
    } catch (error) {
      console.error('Error starting MirrorRuntime service:', error);
      process.exit(1);
    }
  };

  const stopService = async () => {
    try {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await service.stop();
      console.log('MirrorRuntime service stopped successfully.');
      process.exit(0);
    } catch (error) {
      console.error('Error stopping MirrorRuntime service:', error);
      process.exit(1);
    }
  };

  // Gracefully handle shutdown
  process.on('SIGINT', stopService);
  process.on('SIGTERM', stopService);

  // Start the service
  await startService();

  console.log(`Current status: ${service.getStatus()}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
