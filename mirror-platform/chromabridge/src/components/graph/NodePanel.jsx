import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Plus, Compass, Boxes, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { useBackToClose } from '@/hooks/useBackToClose';
import RelationshipEditor from '@/components/graph/RelationshipEditor';

function deriveClimate(x, y, z) {
  return [
    x > 0 ? 'Warm' : x < 0 ? 'Cool' : 'Neutral',
    y > 50 ? 'Differentiated' : y < 20 ? 'Abstract' : 'Partial',
    z > 0 ? 'Vivid' : z < 0 ? 'Muted' : 'Neutral',
  ];
}

function NodePanelContent({ node, onUpdate, onDelete, onClose, anchorMap, domainMap }) {
  const [newLabel, setNewLabel] = useState('');

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-white/5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-6 h-6 rounded-full ring-2 ring-white/10 shrink-0"
            style={{ backgroundColor: node.hex, boxShadow: `0 0 12px ${node.hex}` }}
          />
          <input
            className="bg-transparent text-white text-lg font-semibold focus:outline-none border-none flex-1 min-w-0"
            value={node.name}
            onChange={e => onUpdate(node.id, { name: e.target.value })}
          />
        </div>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors shrink-0 ml-2">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Visibility toggle */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          {node.visibility === 'private' ? <EyeOff className="w-3.5 h-3.5 text-white/40" /> : <Eye className="w-3.5 h-3.5 text-white/40" />}
          <span className="text-[10px] uppercase tracking-wider text-white/40">
            {node.visibility === 'private' ? 'Private Draft' : 'Public'}
          </span>
        </div>
        <Switch
          checked={node.visibility !== 'private'}
          onCheckedChange={(checked) => onUpdate(node.id, { visibility: checked ? 'public' : 'private' })}
        />
      </div>

      {/* Anchor lineage */}
      {node.parent_anchor_id && (
        <div className="px-5 py-3 border-b border-white/5">
          <label className="text-[10px] uppercase tracking-wider text-white/30 block mb-1.5">Anchor Lineage</label>
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-indigo-400/70" />
            <span className="text-sm text-white/80">{anchorMap?.get(node.parent_anchor_id) || 'Unknown anchor'}</span>
          </div>
          {Array.isArray(node.anchor_bearing) && node.anchor_bearing.length >= 3 && (
            <div className="flex gap-4 mt-2">
              {['ΔX', 'ΔY', 'ΔZ'].map((axis, i) => (
                <div key={axis} className="flex flex-col items-center">
                  <span className="text-[9px] text-white/30">{axis}</span>
                  <span className="text-xs font-mono text-white/60">{node.anchor_bearing[i].toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Domain partition */}
      {node.domain_id && (
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] uppercase tracking-wider text-white/30">Domain Partition</label>
            {node.symbolic_address && (
              <span className="text-sm font-mono text-white/80 tracking-widest">{node.symbolic_address}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Boxes className="w-3.5 h-3.5 text-violet-400/70" />
            <div
              className="w-3 h-3 rounded-full ring-1 ring-white/10"
              style={{ backgroundColor: domainMap?.get(node.domain_id)?.color || '#888' }}
            />
            <span className="text-sm text-white/80">{domainMap?.get(node.domain_id)?.name || 'Unknown domain'}</span>
          </div>
          {node.is_intersection && (
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] bg-violet-500/10 text-violet-300 border border-violet-500/20">
              Cross-domain intersection
            </span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {/* Color */}
        <div>
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={node.hex}
              onChange={e => onUpdate(node.id, { hex: e.target.value })}
              className="w-10 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer"
            />
            <input
              value={node.hex}
              onChange={e => onUpdate(node.id, { hex: e.target.value })}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-white/20"
            />
          </div>
        </div>

        {/* Position */}
        <div>
          <label className="text-xs uppercase tracking-wider text-white/40 mb-3 block">Position</label>
          <div className="space-y-2.5">
            {[
              { label: 'Abstract ↔ Concrete', value: node.x, min: -255, max: 255 },
              { label: 'General ↔ Specific', value: node.y, min: 0, max: 255 },
              { label: 'Passive ↔ Active', value: node.z, min: -255, max: 255 },
            ].map(axis => (
              <div key={axis.label} className="flex items-center gap-3">
                <span className="text-xs text-white/50 w-40 shrink-0">{axis.label}</span>
                <div className="flex-1 h-1 bg-white/10 rounded-full relative">
                  <div
                    className="!absolute h-1 rounded-full"
                    style={{
                      width: `${((axis.value - axis.min) / (axis.max - axis.min)) * 100}%`,
                      backgroundColor: node.hex,
                    }}
                  />
                </div>
                <span className="text-xs text-white/70 font-mono w-12 text-right">{axis.value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Derived climate */}
        <div>
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">Derived Climate</label>
          <div className="flex flex-wrap gap-2">
            {deriveClimate(node.x, node.y, node.z).map(climate => (
              <span key={climate} className="px-2.5 py-1 rounded-full text-xs bg-white/5 text-white/60 border border-white/5">
                {climate}
              </span>
            ))}
          </div>
        </div>

        {/* Hierarchy (Parents) */}
        <RelationshipEditor
          title="Hierarchy (Parents)"
          items={node.parents || []}
          badgeClass="bg-amber-500/10 text-amber-300/80 border border-amber-500/20"
          onAdd={(item) => onUpdate(node.id, { parents: [...(node.parents || []), item] })}
          onRemove={(item) => onUpdate(node.id, { parents: (node.parents || []).filter(p => p !== item) })}
        />

        {/* Synonyms */}
        <RelationshipEditor
          title="Synonyms"
          items={node.synonyms || []}
          badgeClass="bg-emerald-500/10 text-emerald-300/80 border border-emerald-500/20"
          onAdd={(item) => onUpdate(node.id, { synonyms: [...(node.synonyms || []), item] })}
          onRemove={(item) => onUpdate(node.id, { synonyms: (node.synonyms || []).filter(s => s !== item) })}
        />

        {/* Opposites */}
        <RelationshipEditor
          title="Opposites"
          items={node.opposites || []}
          badgeClass="bg-red-500/10 text-red-300/80 border border-red-500/20"
          onAdd={(item) => onUpdate(node.id, { opposites: [...(node.opposites || []), item] })}
          onRemove={(item) => onUpdate(node.id, { opposites: (node.opposites || []).filter(o => o !== item) })}
        />

        {/* Semantic labels */}
        <div>
          <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">Semantic Labels</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {(node.semantic_labels || []).map(label => (
              <span key={label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-white/5 text-white/80 border border-white/10">
                {label}
                <button
                  onClick={() => onUpdate(node.id, { semantic_labels: (node.semantic_labels || []).filter(l => l !== label) })}
                  className="text-white/30 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {(node.semantic_labels || []).length === 0 && (
              <span className="text-xs text-white/30 italic">No labels yet</span>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  const trimmed = newLabel.trim();
                  if (trimmed && !(node.semantic_labels || []).includes(trimmed)) {
                    onUpdate(node.id, { semantic_labels: [...(node.semantic_labels || []), trimmed] });
                    setNewLabel('');
                  }
                }
              }}
              placeholder="Add label…"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const trimmed = newLabel.trim();
                if (trimmed && !(node.semantic_labels || []).includes(trimmed)) {
                  onUpdate(node.id, { semantic_labels: [...(node.semantic_labels || []), trimmed] });
                  setNewLabel('');
                }
              }}
              className="text-white/50 hover:text-white px-2"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Delete */}
      <div className="p-5 pb-6 safe-bottom border-t border-white/5">
        <Button
          variant="ghost"
          onClick={() => onDelete(node.id)}
          className="w-full text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Node
        </Button>
      </div>
    </>
  );
}

export default function NodePanel({ node, onUpdate, onDelete, onClose, anchorMap, domainMap }) {
  const isMobile = useIsMobile();
  const isOpen = !!node;
  useBackToClose(isOpen, onClose);

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DrawerContent className="max-h-[85vh] bg-[#16161F] border-white/10 flex flex-col">
          {node && (
            <NodePanelContent node={node} onUpdate={onUpdate} onDelete={onDelete} onClose={onClose} anchorMap={anchorMap} domainMap={domainMap} />
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          initial={{ x: 340, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 340, opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="absolute right-0 top-0 h-full w-80 z-20 bg-[#16161F]/95 backdrop-blur-xl border-l border-white/5 flex flex-col"
        >
          <NodePanelContent node={node} onUpdate={onUpdate} onDelete={onDelete} onClose={onClose} anchorMap={anchorMap} domainMap={domainMap} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}