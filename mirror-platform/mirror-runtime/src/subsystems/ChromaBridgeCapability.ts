import { Coordinate } from '../types';
import { Capability } from './CapabilityRouter';
import {
  evaluate as evaluateWithChromaBridge,
  evaluateNotation as evaluateNotationWithChromaBridge,
  type ChromaBridgeNotationBoundary,
  type ChromaBridgeEvaluation
} from '@mirror-platform/chromabridge-sdk';

export interface ColorNode {
  id: string;
  coordinate: Coordinate;
  label: string;
  anchor?: string;
}

export class ChromaBridgeCapability implements Capability {
  name = 'ChromaBridge';
  version = '1.0.0';
  private nodes = new Map<string, ColorNode>();

  async initialize(): Promise<void> {
    console.log('[ChromaBridgeCapability] Initialized');
  }

  async teardown(): Promise<void> {
    console.log('[ChromaBridgeCapability] Torn down');
  }

  createNode(id: string, coordinate: Coordinate, label: string, anchor?: string): ColorNode {
    const node: ColorNode = { id, coordinate, label, anchor };
    this.nodes.set(id, node);
    console.log(`[ChromaBridge] Created node: ${id} at (${coordinate.x}, ${coordinate.y}, ${coordinate.z})`);
    return node;
  }

  getNode(id: string): ColorNode | undefined {
    return this.nodes.get(id);
  }

  listNodes(): ColorNode[] {
    return Array.from(this.nodes.values());
  }

  evaluate(text: string, userId?: string): ChromaBridgeEvaluation {
    return evaluateWithChromaBridge({ text, userId });
  }

  evaluateNotation(notation: string): ChromaBridgeNotationBoundary {
    return evaluateNotationWithChromaBridge({ notation });
  }

  distance(id1: string, id2: string): number | null {
    const n1 = this.nodes.get(id1);
    const n2 = this.nodes.get(id2);
    if (!n1 || !n2) return null;

    const dx = n2.coordinate.x - n1.coordinate.x;
    const dy = n2.coordinate.y - n1.coordinate.y;
    const dz = n2.coordinate.z - n1.coordinate.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
