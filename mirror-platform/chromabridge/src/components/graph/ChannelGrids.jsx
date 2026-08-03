import React, { useMemo } from 'react';

const HEX_LABELS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];

function parseDigit(hex, index) {
  let h = (hex || '#888888').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length < 6) h = (h + '000000').slice(0, 6);
  return parseInt(h[index], 16);
}

function ChannelStrip({ title, nodes, digitIndex, accent, selectedNodeId, onSelectNode }) {
  const placed = useMemo(() => {
    const buckets = new Map();
    nodes.forEach((n) => {
      const v = parseDigit(n.hex, digitIndex);
      if (!buckets.has(v)) buckets.set(v, []);
      buckets.get(v).push(n);
    });
    const result = [];
    buckets.forEach((items, v) => {
      items.forEach((item, i) => {
        const count = items.length;
        const jitter = count > 1 ? (i - (count - 1) / 2) * (8 / count) : 0;
        result.push({ node: item, value: v, jitter });
      });
    });
    return result;
  }, [nodes, digitIndex]);

  return (
    <div className="flex-1 flex flex-col bg-[#12121A] rounded-2xl border border-white/5 overflow-hidden min-w-0">
      <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: accent }} />
          <h3 className="text-sm font-semibold text-white">{title}</h3>
        </div>
        <span className="text-xs text-white/40 font-mono">{nodes.length}</span>
      </div>
      <div className="flex-1 flex items-stretch p-3 min-h-0 gap-1">
        {HEX_LABELS.map((label, col) => {
          const items = placed.filter(p => p.value === col);
          return (
            <div key={col} className="flex-1 flex flex-col justify-end items-center relative min-w-0">
              <div className="absolute inset-0 rounded-md bg-white/[0.015] border border-white/[0.02]" />
              <div className="relative w-full flex flex-col-reverse items-center gap-1 pb-1">
                {items.map(({ node, jitter }) => {
                  const isSelected = node.id === selectedNodeId;
                  return (
                    <button
                      key={node.id}
                      onClick={() => onSelectNode(node.id)}
                      className="rounded-full transition-transform hover:scale-150 hover:z-20 relative"
                      style={{
                        backgroundColor: node.hex,
                        width: isSelected ? 14 : 10,
                        height: isSelected ? 14 : 10,
                        marginLeft: `${jitter}px`,
                        boxShadow: isSelected
                          ? `0 0 0 2px #ffffff, 0 0 10px ${node.hex}`
                          : `0 0 3px ${node.hex}80`,
                        zIndex: isSelected ? 15 : 1,
                        border: '1px solid rgba(0,0,0,0.3)',
                      }}
                      title={node.name}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-3 pb-2 flex justify-between">
        {HEX_LABELS.map(l => (
          <span key={l} className="text-[9px] text-white/30 font-mono flex-1 text-center">{l}</span>
        ))}
      </div>
    </div>
  );
}

export default function ChannelGrids({ nodes, selectedNodeId, onSelectNode }) {
  const visibleNodes = useMemo(
    () => (nodes || []).filter(n => n && n.hex),
    [nodes]
  );

  return (
    <div className="absolute inset-0 bg-[#0E0E12] overflow-hidden flex flex-col">
      <div className="flex-1 grid grid-cols-3 grid-rows-2 gap-3 p-4 pt-20 min-h-0">
        <ChannelStrip
          title="Red · X"
          nodes={visibleNodes}
          digitIndex={0}
          accent="#EF4444"
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
        <ChannelStrip
          title="Red · Y"
          nodes={visibleNodes}
          digitIndex={1}
          accent="#EF4444"
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
        <ChannelStrip
          title="Green · X"
          nodes={visibleNodes}
          digitIndex={2}
          accent="#22C55E"
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
        <ChannelStrip
          title="Green · Y"
          nodes={visibleNodes}
          digitIndex={3}
          accent="#22C55E"
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
        <ChannelStrip
          title="Blue · X"
          nodes={visibleNodes}
          digitIndex={4}
          accent="#3B82F6"
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
        <ChannelStrip
          title="Blue · Y"
          nodes={visibleNodes}
          digitIndex={5}
          accent="#3B82F6"
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
      </div>
    </div>
  );
}