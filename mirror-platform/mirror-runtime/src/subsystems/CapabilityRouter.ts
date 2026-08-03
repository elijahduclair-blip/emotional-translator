import { CapabilityMetadata } from '../types';

export interface Capability {
  name: string;
  version: string;
  initialize(): Promise<void>;
  teardown?(): Promise<void>;
}

export class CapabilityRouter {
  private capabilities = new Map<string, Capability>();
  private metadata = new Map<string, CapabilityMetadata>();

  async register(capability: Capability): Promise<void> {
    const name = capability.name;
    this.capabilities.set(name, capability);
    this.metadata.set(name, {
      name,
      version: capability.version,
      enabled: true,
    });
    await capability.initialize();
    console.log(`[CapabilityRouter] Registered: ${name} v${capability.version}`);
  }

  async unregister(name: string): Promise<void> {
    const capability = this.capabilities.get(name);
    if (capability?.teardown) {
      await capability.teardown();
    }
    this.capabilities.delete(name);
    this.metadata.delete(name);
    console.log(`[CapabilityRouter] Unregistered: ${name}`);
  }

  getCapability<T extends Capability>(name: string): T | undefined {
    return this.capabilities.get(name) as T | undefined;
  }

  listCapabilities(): CapabilityMetadata[] {
    return Array.from(this.metadata.values());
  }
}