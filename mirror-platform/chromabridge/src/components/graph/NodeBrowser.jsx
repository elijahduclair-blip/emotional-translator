import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Star, X } from 'lucide-react';

const TIER_ORDER = ['base', 'bridge', 'shade'];

export default function NodeBrowser({ nodes, selectedNodeId, searchQuery, onSearchChange, onSelectNode, onToggleFavorite, onClose }) {
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    let result = nodes || [];
    if (filter === 'favorites') result = result.filter(n => n.favorite);
    else if (filter !== 'all') result = result.filter(n => n.tier === filter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n => n.name.toLowerCase().includes(q));
    }
    return result;
  }, [nodes, filter, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map();
    TIER_ORDER.forEach(t => map.set(t, []));
    filtered.forEach(n => { map.get(n.tier)?.push(n); });
    return map;
  }, [filtered]);

  return (
    <motion.div
      initial={{ x: -288, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -288, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute left-0 top-0 h-full w-72 z-20 bg-[#16161F]/95 backdrop-blur-xl border-r border-white/5 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <span className="text-white/80 text-sm font-semibold">Node Browser</span>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-white/5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search nodes…"
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 flex-wrap">
        {[
          { key: 'all', label: 'All' },
          { key: 'base', label: 'Base' },
          { key: 'bridge', label: 'Bridge' },
          { key: 'shade', label: 'Shade' },
          { key: 'favorites', label: '★' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1 rounded-full text-xs transition-colors ${filter === f.key ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/50'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {TIER_ORDER.map(tier => {
          const items = grouped.get(tier) || [];
          if (items.length === 0) return null;
          return (
            <div key={tier}>
              <div className="px-4 py-2 text-[10px] uppercase tracking-wider text-white/30 sticky top-0 bg-[#16161F]/95 backdrop-blur-xl border-b border-white/5">
                {tier} · {items.length}
              </div>
              {items.map(node => (
                <div
                  key={node.id}
                  onClick={() => onSelectNode(node.id)}
                  className={`flex items-center gap-2.5 px-4 py-2 cursor-pointer hover:bg-white/5 transition-colors ${selectedNodeId === node.id ? 'bg-white/10' : ''}`}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0 ring-1 ring-white/10"
                    style={{ backgroundColor: node.hex, boxShadow: `0 0 8px ${node.hex}80` }}
                  />
                  <span className="flex-1 text-left text-sm text-white/80 truncate">{node.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(node.id, !node.favorite); }}
                    className={`shrink-0 ${node.favorite ? 'text-amber-300' : 'text-white/20 hover:text-white/40'}`}
                  >
                    <Star className="w-3.5 h-3.5" fill={node.favorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-white/30 text-sm">No nodes found</div>
        )}
      </div>

      {/* Count */}
      <div className="px-4 py-2 border-t border-white/5 text-[10px] text-white/30 text-center">
        {filtered.length} of {nodes?.length || 0} nodes
      </div>
    </motion.div>
  );
}