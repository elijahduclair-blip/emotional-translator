import React, { useState } from 'react';
import { Search, X, Sliders, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WEIGHT_CONFIG = [
  { key: 'w_s', label: 'Text Sim', bar: 'bg-blue-400', text: 'text-blue-300', accent: 'accent-blue-500' },
  { key: 'w_g', label: 'Graph', bar: 'bg-amber-400', text: 'text-amber-300', accent: 'accent-amber-500' },
  { key: 'w_c', label: 'Coord', bar: 'bg-emerald-400', text: 'text-emerald-300', accent: 'accent-emerald-500' },
  { key: 'w_p', label: 'Path', bar: 'bg-violet-400', text: 'text-violet-300', accent: 'accent-violet-500' },
];

function ScoreBar({ label, value, bar }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-white/30 w-3 uppercase">{label}</span>
      <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, value * 100)}%` }} />
      </div>
      <span className="text-[9px] font-mono text-white/30 w-6 text-right">{value.toFixed(2)}</span>
    </div>
  );
}

function WeightControls({ weights, onWeightsChange }) {
  return (
    <div className="space-y-2">
      {WEIGHT_CONFIG.map((wc) => (
        <div key={wc.key} className="flex items-center gap-2">
          <span className={`text-[10px] ${wc.text} w-14 shrink-0`}>{wc.label}</span>
          <input
            type="range" min="0" max="1" step="0.05"
            value={weights[wc.key]}
            onChange={(e) => onWeightsChange({ ...weights, [wc.key]: Number(e.target.value) })}
            className={`flex-1 ${wc.accent}`}
          />
          <span className="text-[10px] font-mono text-white/40 w-6 text-right">{weights[wc.key].toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

function ResultRow({ r, i, onSelect }) {
  return (
    <div
      onClick={() => onSelect(r.node_id)}
      className="px-4 py-2.5 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] text-white/25 font-mono w-5">#{i + 1}</span>
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.hex }} />
        <span className="text-xs text-white/80 flex-1 truncate">{r.name}</span>
        <span className="text-xs font-mono text-blue-300/70">{r.combined.toFixed(3)}</span>
      </div>
      <div className="space-y-1 ml-9">
        <ScoreBar label="S" value={r.scores.S} bar="bg-blue-400" />
        <ScoreBar label="G" value={r.scores.G} bar="bg-amber-400" />
        <ScoreBar label="C" value={r.scores.C} bar="bg-emerald-400" />
        <ScoreBar label="P" value={r.scores.P} bar="bg-violet-400" />
      </div>
    </div>
  );
}

export default function SearchPanel({ hasResults, query, weights, results, searching, queryInterpretation, onQueryChange, onWeightsChange, onSearch, onClear, onSelectResult, onClose }) {
  const [showWeights, setShowWeights] = useState(false);

  const searchInput = (
    <div className="flex gap-2">
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
        placeholder="Search the semantic space…"
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-400/30"
      />
      <Button size="sm" onClick={onSearch} disabled={searching || !query.trim()} className="bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30 rounded-lg">
        {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
      </Button>
    </div>
  );

  const weightToggle = (
    <button onClick={() => setShowWeights(!showWeights)} className="flex items-center gap-1.5 mt-3 text-xs text-white/40 hover:text-white/60 transition-colors">
      <Sliders className="w-3.5 h-3.5" />
      Scoring Weights
      <span className="text-white/20 ml-1 font-mono">R = w_s·S + w_g·G + w_c·C + w_p·P</span>
    </button>
  );

  // ── Landing state: centered hero search over the graph ──
  if (!hasResults && !searching) {
    return (
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-5 pointer-events-auto w-[520px] max-w-[90vw]">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-white/90 tracking-tight">ChromaBridge</h1>
            <p className="text-sm text-white/40 mt-1.5">Explainable Semantic Search Engine</p>
          </div>
          <div className="w-full">
            {searchInput}
            <div className="flex justify-center">{weightToggle}</div>
            {showWeights && (
              <div className="w-full bg-[#16161F]/80 backdrop-blur-xl border border-white/5 rounded-xl p-3 mt-2">
                <WeightControls weights={weights} onWeightsChange={onWeightsChange} />
              </div>
            )}
          </div>
          <p className="text-xs text-white/20 text-center max-w-sm">
            Searches are scored by text similarity, graph strength, coordinate proximity, and path compatibility.
          </p>
        </div>
      </div>
    );
  }

  // ── Results state: full-height left panel ──
  return (
    <div className="absolute top-16 left-4 bottom-4 z-10 w-96 max-w-[85vw] flex flex-col bg-[#16161F]/95 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl">
      {/* Search bar + weights */}
      <div className="p-4 border-b border-white/5">
        {searchInput}
        {weightToggle}
        {showWeights && (
          <div className="mt-2">
            <WeightControls weights={weights} onWeightsChange={onWeightsChange} />
          </div>
        )}
      </div>

      {/* Query interpretation */}
      {queryInterpretation && (
        <div className="px-4 py-2 border-b border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Query Interpretation</div>
          {queryInterpretation.query_labels?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {queryInterpretation.query_labels.map((label) => (
                <span key={label} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-300/70 border border-blue-500/20">{label}</span>
              ))}
            </div>
          )}
          {queryInterpretation.estimated_coord && (
            <div className="text-[10px] font-mono text-white/25">
              est. ({queryInterpretation.estimated_coord.x?.toFixed(0)}, {queryInterpretation.estimated_coord.y?.toFixed(0)}, {queryInterpretation.estimated_coord.z?.toFixed(0)})
            </div>
          )}
        </div>
      )}

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {searching && (
          <div className="px-4 py-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-300 mx-auto" />
            <p className="text-xs text-white/30 mt-2">Searching semantic space…</p>
          </div>
        )}
        {!searching && results.map((r, i) => (
          <ResultRow key={r.node_id} r={r} i={i} onSelect={onSelectResult} />
        ))}
      </div>

      {/* Footer */}
      {!searching && results.length > 0 && (
        <div className="p-3 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-white/30">{results.length} results</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={onClear} className="text-white/50 hover:text-white h-7">
              Clear
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} className="text-white/50 hover:text-white h-7">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}