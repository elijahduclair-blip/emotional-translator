import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, ChevronDown, Star, ChevronsDownUp } from 'lucide-react';
import { useBackToClose } from '@/hooks/useBackToClose';
import TierFilterMenu from '@/components/graph/TierFilterMenu';
import { wordToPath, pathMatches } from '@/utils/lexicalIndex';
import { getShapeForTier, computeProximity } from '@/utils/personaVisuals';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import NodePhysicsIndicator from '@/components/graph/NodePhysicsIndicator';
import { getNodeForceGroup } from '@/utils/physicsEngine';

const TIER_BADGE = {
  base: 'bg-[#2a2b25] text-[#d4af37] border-[#3d4036]',
  bridge: 'bg-[#2a2b25] text-[#c5a878] border-[#3d4036]',
  shade: 'bg-[#2a2b25] text-[#807a6a] border-[#3d4036]',
  words: 'bg-[#2a2b25] text-[#8a9a7a] border-[#3d4036]',
};

const FORCE_COLORS = {
  gravity: '#5b6ee0',
  current: '#d9a64a',
  refraction: '#4ad97a',
};

function buildTree(nodes) {
  const nodeMap = new Map(nodes.map(n => [n.name, n]));
  const childrenMap = new Map();
  const roots = [];

  nodes.forEach(node => {
    const parents = (node.parents || []).filter(p => nodeMap.has(p));
    if (parents.length === 0) {
      roots.push(node);
    } else {
      parents.forEach(parentName => {
        if (!childrenMap.has(parentName)) childrenMap.set(parentName, []);
        childrenMap.get(parentName).push(node);
      });
    }
  });

  return { roots, childrenMap, nodeMap };
}

function TreeNode({ node, childrenMap, depth, selectedNodeId, onSelectNode, onToggleFavorite, expandedSet, toggleExpand, pathMode, pathEndpoints, onPathNodeSelect, visited, anchorMap, persona, allNodes }) {
  const children = childrenMap.get(node.name) || [];
  const isExpanded = expandedSet.has(node.name);
  const isSelected = selectedNodeId === node.id;
  const pathIdx = pathEndpoints ? pathEndpoints.indexOf(node.id) : -1;

  // Compute nearby nodes for physics (within distance 100)
  const neighbors = useMemo(() => {
    if (!allNodes) return [];
    return allNodes.filter(n => n.id !== node.id && Math.sqrt((n.x - node.x) ** 2 + (n.y - node.y) ** 2 + (n.z - node.z) ** 2) < 100);
  }, [allNodes, node.id, node.x, node.y, node.z]);

  const handleClick = () => {
    if (pathMode && onPathNodeSelect) {
      onPathNodeSelect(node.id);
    } else {
      onSelectNode(node.id);
    }
  };

  return (
    <div className="relative">
      {Array.from({ length: depth }, (_, i) => (
        <div key={`rail-${i}`} className="absolute top-0 bottom-0 w-px bg-[#3d4036]/40 pointer-events-none" style={{ left: `${i * 20 + 14}px` }} />
      ))}
      {depth > 0 && (
        <div className="absolute top-1/2 -translate-y-1/2 h-px bg-[#3d4036]/40 pointer-events-none" style={{ left: `${(depth - 1) * 20 + 14}px`, width: '14px' }} />
      )}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-[#d4af37] pointer-events-none" />
      )}
      <div
        onClick={handleClick}
        className={`relative flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors border-b border-[#3d4036]/50 hover:bg-[#2a2b25] ${isSelected ? 'bg-[#2a2b25]' : ''} ${pathMode && pathIdx >= 0 ? 'bg-[#d4af37]/10 ring-1 ring-[#d4af37]/20' : ''}`}
        style={{ paddingLeft: `${depth * 20 + 8}px`, opacity: persona?.preferredDomainId && node.domain_id && node.domain_id !== persona.preferredDomainId ? 0.3 : 1 }}
      >
        {children.length > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); toggleExpand(node.name); }}
            className="shrink-0 text-[#807a6a] hover:text-[#d4af37] transition-colors"
          >
            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {(() => {
          const shape = persona ? getShapeForTier(persona.profile, node.tier) : null;
          const proximity = persona ? computeProximity(node, persona.origin) : 0;
          const isDimmed = persona?.preferredDomainId && node.domain_id && node.domain_id !== persona.preferredDomainId;
          const forceGroup = getNodeForceGroup(node);
          const forceColor = forceGroup ? FORCE_COLORS[forceGroup] : null;
          const glowSize = 6 + proximity * 16;
          const glowAlpha = proximity > 0.6 ? '' : '80';
          const dotStyle = { backgroundColor: node.hex, boxShadow: `0 0 ${glowSize}px ${node.hex}${glowAlpha}` };
          if (forceColor) {
            dotStyle.boxShadow = `0 0 ${glowSize}px ${node.hex}${glowAlpha}, 0 0 ${glowSize + 4}px ${forceColor}60`;
          }
          if (shape) {
            if (shape.borderRadius) dotStyle.borderRadius = shape.borderRadius;
            if (shape.clipPath) dotStyle.clipPath = shape.clipPath;
            if (shape.width) dotStyle.width = shape.width;
            if (shape.height) dotStyle.height = shape.height;
          }
          return (
            <div
              className="w-3 h-3 rounded-full shrink-0 ring-1 ring-[#3d4036]"
              style={dotStyle}
            />
          );
        })()}
        {node.parent_anchor_id && node.tier !== 'base' && anchorMap?.get(node.parent_anchor_id) && (
          <div
            className="w-2 h-2 rounded-full shrink-0 ring-1 ring-[#3d4036] -ml-1.5"
            style={{ backgroundColor: anchorMap.get(node.parent_anchor_id).hex }}
            title={`Anchor: ${anchorMap.get(node.parent_anchor_id).name}`}
          />
        )}
        <span className={`flex-1 text-sm truncate ${isSelected ? 'text-[#d4c5a0] font-medium' : 'text-[#d4c5a0]/60'}`}>{node.name}</span>
        <NodePhysicsIndicator node={node} neighbors={neighbors} />
        {pathIdx >= 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#2a2b25] text-[#d4af37] border border-[#3d4036] font-mono">
            {pathIdx + 1}
          </span>
        )}
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${TIER_BADGE[node.tier] || TIER_BADGE.shade}`}>
          {node.tier}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(node.id, !node.favorite); }}
          className={`shrink-0 ${node.favorite ? 'text-[#d4af37]' : 'text-[#807a6a] hover:text-[#d4af37]'}`}
        >
          <Star className="w-3 h-3" fill={node.favorite ? 'currentColor' : 'none'} />
        </button>
      </div>
      {isExpanded && children.map(child => {
        if (visited.has(child.name)) return null;
        return (
          <TreeNode
            key={`${child.id}-${node.name}`}
            node={child}
            childrenMap={childrenMap}
            depth={depth + 1}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            onToggleFavorite={onToggleFavorite}
            expandedSet={expandedSet}
            toggleExpand={toggleExpand}
            pathMode={pathMode}
            pathEndpoints={pathEndpoints}
            onPathNodeSelect={onPathNodeSelect}
            visited={new Set([...visited, node.name])}
            anchorMap={anchorMap}
            persona={persona}
            allNodes={allNodes}
          />
        );
      })}
    </div>
  );
}

export default function HierarchyTree({ nodes, searchQuery, selectedNodeId, onSelectNode, onToggleFavorite, pathMode, pathEndpoints, onPathNodeSelect, persona }) {
  const [visibleTiers, setVisibleTiers] = useState({ base: true, bridge: true, shade: true, words: true });
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [expandedSet, setExpandedSet] = useState(new Set());
  const [hiddenRoots, setHiddenRoots] = useState(new Set());
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const familySheetOpen = searchParams.get('families') === 'open';
  const setFamilySheetOpen = useCallback((open) => {
    const next = new URLSearchParams(window.location.search);
    if (open) next.set('families', 'open');
    else next.delete('families');
    setSearchParams(next);
  }, [setSearchParams]);
  useBackToClose(familySheetOpen, () => setFamilySheetOpen(false));

  const toggleTier = (tier) => {
    setVisibleTiers(prev => ({ ...prev, [tier]: !prev[tier] }));
  };
  const showAllTiers = () => setVisibleTiers({ base: true, bridge: true, shade: true, words: true });
  const hideAllTiers = () => setVisibleTiers({ base: false, bridge: false, shade: false, words: false });

  const tierCounts = useMemo(() => {
    const counts = { base: 0, bridge: 0, shade: 0, words: 0 };
    (nodes || []).forEach(n => { if (counts[n.tier] !== undefined) counts[n.tier]++; });
    return counts;
  }, [nodes]);

  const { roots: allRoots, childrenMap: allChildrenMap } = useMemo(() => buildTree(nodes || []), [nodes]);

  const anchorMap = useMemo(() => {
    const m = new Map();
    (nodes || []).forEach(n => { if (n.tier === 'base') m.set(n.id, n); });
    return m;
  }, [nodes]);

  const familySizes = useMemo(() => {
    const sizes = new Map();
    function countDesc(rootName) {
      const stack = [rootName];
      const visited = new Set();
      let count = 0;
      while (stack.length > 0) {
        const name = stack.pop();
        if (visited.has(name)) continue;
        visited.add(name);
        count++;
        const children = allChildrenMap.get(name) || [];
        for (const c of children) {
          if (!visited.has(c.name)) stack.push(c.name);
        }
      }
      return count;
    }
    allRoots.forEach(r => { sizes.set(r.name, countDesc(r.name)); });
    return sizes;
  }, [allRoots, allChildrenMap]);

  const hiddenNames = useMemo(() => {
    if (hiddenRoots.size === 0) return null;
    const hidden = new Set();
    function collect(rootName) {
      const stack = [rootName];
      const visited = new Set();
      while (stack.length > 0) {
        const name = stack.pop();
        if (visited.has(name)) continue;
        visited.add(name);
        hidden.add(name);
        const children = allChildrenMap.get(name) || [];
        for (const c of children) {
          if (!visited.has(c.name)) stack.push(c.name);
        }
      }
    }
    hiddenRoots.forEach(rootName => collect(rootName));
    return hidden;
  }, [hiddenRoots, allChildrenMap]);

  const filtered = useMemo(() => {
    let result = nodes || [];
    if (hiddenNames) {
      result = result.filter(n => !hiddenNames.has(n.name));
    }
    result = result.filter(n => visibleTiers[n.tier] !== false);
    if (favoritesOnly) result = result.filter(n => n.favorite);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const searchPath = wordToPath(searchQuery.trim());
      result = result.filter(n => {
        if (n.lexical_path && n.lexical_path.length > 0) {
          return pathMatches(searchPath, n.lexical_path);
        }
        return n.name.toLowerCase().includes(q);
      });
    }
    return result;
  }, [nodes, visibleTiers, favoritesOnly, searchQuery, hiddenNames]);

  const { roots, childrenMap } = useMemo(() => buildTree(filtered), [filtered]);

  const toggleRoot = (name) => {
    setHiddenRoots(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const showAllFamilies = () => setHiddenRoots(new Set());
  const hideAllFamilies = () => setHiddenRoots(new Set(allRoots.map(r => r.name)));
  const collapseAll = () => setExpandedSet(new Set());

  const toggleExpand = (name) => {
    setExpandedSet(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Auto-expand all when searching
  const effectiveExpanded = searchQuery.trim() ? new Set(filtered.map(n => n.name)) : expandedSet;

  // Group roots by tier
  const tierOrder = ['base', 'bridge', 'shade', 'words'];
  const rootsByTier = tierOrder
    .map(tier => ({ tier, items: roots.filter(n => n.tier === tier) }))
    .filter(g => g.items.length > 0);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Family filter sidebar */}
      <div className="w-52 shrink-0 border-r border-[#3d4036] bg-[#1a1a14] overflow-y-auto hidden md:block">
        <div className="px-4 py-2.5 border-b border-[#3d4036] sticky top-0 bg-[#1a1a14] backdrop-blur-xl z-10">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#d4c5a0]">Families</span>
            <div className="flex gap-1">
              <button onClick={showAllFamilies} className="text-[9px] text-[#807a6a] hover:text-[#d4af37] transition-colors">All</button>
              <span className="text-[#3d4036]">·</span>
              <button onClick={hideAllFamilies} className="text-[9px] text-[#807a6a] hover:text-[#d4af37] transition-colors">None</button>
            </div>
          </div>
        </div>
        {allRoots.map(root => (
          <label key={root.id} className="flex items-center gap-2 px-4 py-1.5 cursor-pointer hover:bg-[#2a2b25] transition-colors border-b border-[#3d4036]/50">
            <input
              type="checkbox"
              checked={!hiddenRoots.has(root.name)}
              onChange={() => toggleRoot(root.name)}
              className="w-3 h-3 accent-[#d4af37] shrink-0"
            />
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: root.hex }} />
            <span className="text-xs text-[#d4c5a0]/70 truncate flex-1">{root.name}</span>
            <span className="text-[9px] text-[#d4af37]">{familySizes.get(root.name) || 0}</span>
          </label>
        ))}
        {allRoots.length === 0 && (
          <div className="p-4 text-center text-[#807a6a] text-xs">No families</div>
        )}
      </div>

      {/* Tree area */}
      <div className="flex-1 overflow-y-auto bg-[#1a1a14]" style={{ backgroundImage: 'radial-gradient(circle, rgba(212,175,55,0.05) 1px, transparent 1px)', backgroundSize: '18px 18px' }}>
      {/* Mobile family toggle */}
      {isMobile && (
        <button onClick={() => setFamilySheetOpen(true)} className="w-full flex items-center justify-between px-4 py-2.5 border-b border-[#3d4036] bg-[#2a2b25] text-xs text-[#d4c5a0] hover:text-[#d4af37] transition-colors">
          <span className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[#d4c5a0]">Families</span>
            <span className="text-[#d4af37]">({allRoots.length})</span>
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#807a6a]" />
        </button>
      )}
      {/* Filter pills */}
      <div className="sticky top-0 z-10 bg-[#1a1a14] border-b border-[#3d4036] px-4 py-2 flex items-center gap-1.5">
        <TierFilterMenu
          visibleTiers={visibleTiers}
          onToggle={toggleTier}
          onAll={showAllTiers}
          onNone={hideAllTiers}
          counts={tierCounts}
        />
        <button
          onClick={() => setFavoritesOnly(prev => !prev)}
          className={`px-2.5 py-1 rounded-full text-xs transition-colors border ${favoritesOnly ? 'text-[#d4af37] bg-[#2a2b25] border-[#3d4036]' : 'text-[#807a6a] bg-[#2a2b25] border-[#3d4036] hover:text-[#d4c5a0]'}`}
        >
          ★ Favorites
        </button>
        <span className="ml-auto text-[10px] text-[#d4af37] px-2 py-0.5 rounded-full bg-[#2a2b25] border border-[#3d4036]">{filtered.length}</span>
        <button
          onClick={collapseAll}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] text-[#d4c5a0] bg-[#2a2b25] border border-[#3d4036] hover:text-[#d4af37] transition-colors"
          title="Collapse all nodes"
        >
          <ChevronsDownUp className="w-3 h-3" />
          Collapse All
        </button>
      </div>

      {/* Tree */}
      <div className="py-2 min-h-[200px]">
        {rootsByTier.map(({ tier, items }) => (
          <div key={tier} className="mb-2">
            <div className="flex items-center gap-1.5 px-4 py-1.5 text-[10px] uppercase tracking-wider text-[#d4c5a0] border-b border-[#3d4036] bg-[#2a2b25]/50"><ChevronDown className="w-3 h-3 text-[#d4af37]" /><span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] shrink-0 shadow-[0_0_4px_#d4af37]" />{tier}<span className="text-[#807a6a]">•</span><span className="text-[#d4af37]">{items.length}</span></div>
            {items.map(node => (
              <TreeNode
                key={node.id}
                node={node}
                childrenMap={childrenMap}
                depth={0}
                selectedNodeId={selectedNodeId}
                onSelectNode={onSelectNode}
                onToggleFavorite={onToggleFavorite}
                expandedSet={effectiveExpanded}
                toggleExpand={toggleExpand}
                pathMode={pathMode}
                pathEndpoints={pathEndpoints}
                onPathNodeSelect={onPathNodeSelect}
                visited={new Set()}
                anchorMap={anchorMap}
                persona={persona}
                allNodes={nodes}
                />
                ))}
                </div>
                ))}
        {filtered.length === 0 && (
          <div className="p-12 text-center text-[#807a6a] text-sm">No nodes found</div>
        )}
      </div>
      </div>

      {/* Mobile family sheet */}
      <Drawer open={familySheetOpen} onOpenChange={setFamilySheetOpen}>
        <DrawerContent className="bg-[#1a1a14] border-[#3d4036] safe-bottom">
          <div className="px-4 py-2.5 border-b border-[#3d4036]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-[#d4c5a0]">Families</span>
              <div className="flex gap-1">
                <button onClick={showAllFamilies} className="text-[9px] text-[#807a6a] hover:text-[#d4af37] transition-colors">All</button>
                <span className="text-[#3d4036]">·</span>
                <button onClick={hideAllFamilies} className="text-[9px] text-[#807a6a] hover:text-[#d4af37] transition-colors">None</button>
              </div>
            </div>
          </div>
          <div className="max-h-[50vh] overflow-y-auto pb-4">
            {allRoots.map(root => (
              <label key={root.id} className="flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-[#2a2b25] transition-colors border-b border-[#3d4036]/50">
                <input type="checkbox" checked={!hiddenRoots.has(root.name)} onChange={() => toggleRoot(root.name)} className="w-3.5 h-3.5 accent-[#d4af37] shrink-0" />
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: root.hex }} />
                <span className="text-sm text-[#d4c5a0]/70 truncate flex-1">{root.name}</span>
                <span className="text-[10px] text-[#d4af37]">{familySizes.get(root.name) || 0}</span>
              </label>
            ))}
            {allRoots.length === 0 && <div className="p-4 text-center text-[#807a6a] text-sm">No families</div>}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}