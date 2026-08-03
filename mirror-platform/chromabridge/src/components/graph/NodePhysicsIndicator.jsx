import React, { useMemo } from 'react';
import { getNodeForceGroup, cognitiveDrift } from '@/utils/physicsEngine';

const FORCE_COLORS = {
  gravity: '#5b6ee0',
  current: '#d9a64a',
  refraction: '#4ad97a',
};

const FORCE_GLYPH = {
  gravity: '↓',
  current: '→',
  refraction: '≈',
};

/**
 * Renders a physics force indicator for a node in the graph tree.
 * Shows the shape-trait force group color, energy level, and drift direction.
 */
export default function NodePhysicsIndicator({ node, neighbors }) {
  const physics = useMemo(() => {
    const group = getNodeForceGroup(node);
    if (!group) return null;
    const drift = cognitiveDrift(node, neighbors || []);
    return { group, drift };
  }, [node, neighbors]);

  if (!physics) return null;

  const color = FORCE_COLORS[physics.group];
  const energy = Math.min(physics.drift.magnitude, 1);
  const glowSize = 2 + energy * 8;

  return (
    <div className="flex items-center gap-0.5 shrink-0" title={`${physics.group} force · energy ${energy.toFixed(2)}`}>
      <div
        className="w-1 h-1 rounded-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 ${glowSize}px ${color}`,
        }}
      />
      <span className="text-[8px] font-mono leading-none" style={{ color }}>
        {FORCE_GLYPH[physics.group]}
      </span>
    </div>
  );
}