import { MirrorRuntime } from '../MirrorRuntime';
import { MirrorRuntimeConfig, RuntimeStatus } from '../types';

export class MirrorRuntimeService {
  private runtime: MirrorRuntime;

  constructor(config?: Partial<MirrorRuntimeConfig>) {
    this.runtime = new MirrorRuntime({
      userId: config?.userId || 'default-user',
      constitutionPath: config?.constitutionPath,
      enablePersistence: config?.enablePersistence ?? true,
      enableCodexGraphRead: config?.enableCodexGraphRead ?? true,
      enableLocalModel: config?.enableLocalModel ?? true,
      codexApiUrl: config?.codexApiUrl,
      codexServiceToken: config?.codexServiceToken,
      localModelUrl: config?.localModelUrl,
      localModelName: config?.localModelName,
    });
  }

  async start(): Promise<void> {
    await this.runtime.start();
  }

  async stop(): Promise<void> {
    await this.runtime.stop();
  }

  getStatus(): RuntimeStatus {
    return this.runtime.getStatus();
  }

  async getHealth() {
    return {
      status: this.runtime.getStatus(),
      localModel: await this.runtime.getLocalModelStatus()
    };
  }

  getRuntime(): MirrorRuntime {
    return this.runtime;
  }
}
