import React, { useState } from 'react';
import { Plus, Grid3x3, Tag, Network, Download, Loader2, Check, ExternalLink, Boxes, Sparkles, GitBranch, Layers, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

function Toggle({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors ${active ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/50'}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

export default function SceneToolbar({ threshold, onThresholdChange, toggles, onToggleChange, tierVisibility, onToggleTier, onAddNode, discoveryOpen, onToggleDiscovery, onSeedComplete, hexSlot, onHexSlotChange, viewMode, onViewModeChange, relationshipVisibility, onToggleRelationship }) {
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    setExportResult(null);
    try {
      const res = await base44.functions.invoke('exportToSheets', {});
      setExportResult(res.data);
    } catch (e) {
      setExportResult({ error: e.response?.data?.error || e.message });
    } finally {
      setExporting(false);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await base44.functions.invoke('seedWordNetHierarchy', {});
      setSeedResult(res.data);
      if (onSeedComplete) onSeedComplete();
    } catch (e) {
      setSeedResult({ error: e.response?.data?.error || e.message });
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 px-5 py-2.5 bg-[#16161F]/90 backdrop-blur-xl border border-white/5 rounded-full shadow-2xl">
      {/* View mode */}
      <div className="flex items-center gap-0.5 bg-white/5 rounded-full p-0.5">
        <button
          onClick={() => onViewModeChange('3d')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${viewMode === '3d' ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/50'}`}
        >3D</button>
        <button
          onClick={() => onViewModeChange('channels')}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${viewMode === 'channels' ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/50'}`}
        >Channels</button>
      </div>

      <div className="w-px h-5 bg-white/10" />

      {/* Proximity threshold */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-white/40 uppercase tracking-wider whitespace-nowrap">Proximity</span>
        <input
          type="range"
          min="20"
          max="200"
          value={threshold}
          onChange={e => onThresholdChange(Number(e.target.value))}
          className="w-24 accent-white/60"
        />
        <span className="text-xs text-white/60 font-mono w-7">{threshold}</span>
      </div>

      <div className="w-px h-5 bg-white/10" />

      {/* Toggles */}
      <div className="flex items-center gap-1">
        <Toggle icon={Grid3x3} label="Grid" active={toggles.grid} onClick={() => onToggleChange('grid', !toggles.grid)} />
        <Toggle icon={Tag} label="Labels" active={toggles.labels} onClick={() => onToggleChange('labels', !toggles.labels)} />
        <Toggle icon={Network} label="Links" active={toggles.connections} onClick={() => onToggleChange('connections', !toggles.connections)} />
        <Toggle icon={Boxes} label="Territory" active={toggles.voronoi} onClick={() => onToggleChange('voronoi', !toggles.voronoi)} />
        <Toggle icon={Flame} label="Heat" active={toggles.heatmap} onClick={() => onToggleChange('heatmap', !toggles.heatmap)} />
      </div>

      <div className="w-px h-5 bg-white/10" />

      {/* Tier visibility */}
      <div className="flex items-center gap-1">
        <Layers className="w-3.5 h-3.5 text-white/30 mr-0.5" />
        {['base', 'bridge', 'shade'].map(tier => (
          <button
            key={tier}
            onClick={() => onToggleTier(tier)}
            className={`px-2 py-1 rounded-full text-xs capitalize transition-colors ${tierVisibility[tier] ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/50 line-through'}`}
          >
            {tier}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-white/10" />

      {/* Relationship types */}
      <div className="flex items-center gap-1">
        <GitBranch className="w-3.5 h-3.5 text-white/30 mr-0.5" />
        {[
          { key: 'hierarchy', label: 'Hierarchy', active: 'text-amber-300 bg-amber-500/10' },
          { key: 'synonym', label: 'Synonyms', active: 'text-emerald-300 bg-emerald-500/10' },
          { key: 'opposite', label: 'Opposites', active: 'text-red-300 bg-red-500/10' },
        ].map(rel => (
          <button
            key={rel.key}
            onClick={() => onToggleRelationship(rel.key)}
            className={`px-2 py-1 rounded-full text-xs transition-colors ${relationshipVisibility[rel.key] ? rel.active : 'text-white/30 hover:text-white/50 line-through'}`}
          >
            {rel.label}
          </button>
        ))}
      </div>

      <div className="w-px h-5 bg-white/10" />

      {/* Hex-position slot axis */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-white/30 uppercase tracking-wider mr-1">Slot</span>
        <button
          onClick={() => onHexSlotChange(null)}
          className={`px-1.5 py-1 rounded-full text-[11px] font-mono transition-colors ${!hexSlot ? 'text-white bg-white/10' : 'text-white/30 hover:text-white/50'}`}
        >Off</button>
        {[1, 2, 3, 4, 5, 6].map(p => (
          <button
            key={p}
            onClick={() => onHexSlotChange(p)}
            className={`w-6 h-6 rounded-full text-[11px] font-mono transition-colors ${hexSlot === p ? 'text-white bg-white/15 ring-1 ring-white/20' : 'text-white/30 hover:text-white/50'}`}
          >{p}</button>
        ))}
      </div>

      <div className="w-px h-5 bg-white/10" />

      <Button size="sm" onClick={onToggleDiscovery} className={discoveryOpen ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 rounded-full' : 'bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-full'}>
        <Sparkles className="w-4 h-4 mr-1.5" />
        Discovery
      </Button>

      <div className="w-px h-5 bg-white/10" />

      <Button size="sm" onClick={onAddNode} className="bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-full">
        <Plus className="w-4 h-4 mr-1.5" />
        Add Node
      </Button>

      <div className="w-px h-5 bg-white/10" />

      <Button
        size="sm"
        onClick={handleSeed}
        disabled={seeding}
        className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 rounded-full"
      >
        {seeding ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <GitBranch className="w-4 h-4 mr-1.5" />}
        {seeding ? 'Seeding…' : 'Seed Hierarchy'}
      </Button>
      {seedResult && !seedResult.error && (
        <span className="text-xs text-indigo-300/80 whitespace-nowrap">
          +{seedResult.hypernymsCreated} nodes, {seedResult.parentsUpdated} links
        </span>
      )}
      {seedResult?.error && (
        <span className="text-xs text-red-400/80">{seedResult.error}</span>
      )}

      <div className="w-px h-5 bg-white/10" />

      <Button
        size="sm"
        onClick={handleExport}
        disabled={exporting}
        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 rounded-full"
      >
        {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
        {exporting ? 'Exporting…' : 'Export'}
      </Button>
      {exportResult && !exportResult.error && (
        <a
          href={exportResult.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
        >
          <Check className="w-3 h-3" />
          {exportResult.count} rows
          <ExternalLink className="w-3 h-3 ml-0.5" />
        </a>
      )}
      {exportResult?.error && (
        <span className="text-xs text-red-400/80">{exportResult.error}</span>
      )}
    </div>
  );
}