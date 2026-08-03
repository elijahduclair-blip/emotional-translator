import React from 'react';
import { Route, X, Play, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function Metric({ label, value, unit }) {
  return (
    <div className="flex flex-col items-center px-2.5 py-1 bg-white/5 rounded-lg border border-white/5">
      <span className="text-[10px] uppercase tracking-wider text-white/35">{label}</span>
      <span className="text-xs font-mono text-white/80">{value}{unit && <span className="text-white/30 ml-0.5">{unit}</span>}</span>
    </div>);

}

export default function PathBar({ pathMode, pathEndpoints, pathSequence, profile, nodes, onTogglePathMode, onTrace, onClear }) {
  const epNodes = pathEndpoints.map((id) => nodes.find((n) => n.id === id)).filter(Boolean);
  const showProfile = profile && epNodes.length === 2;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 max-w-[92vw] flex flex-col items-center gap-2">
      {/* Vector physics profile */}
      {showProfile &&
      <div className="flex flex-col items-center gap-2 px-4 py-2.5 bg-[#16161F]/90 backdrop-blur-xl border border-white/5 rounded-2xl max-w-full overflow-x-auto scrollbar-thin">
          {profile.coordDeltas &&
        <div className="flex items-center gap-2 w-full justify-center pb-2 border-b border-white/5">
              <span className="text-[10px] uppercase tracking-wider text-white/35">Coord Δ</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                <span className="text-[10px] text-blue-300/60">ΔX</span>
                <span className="text-xs font-mono text-blue-200">{profile.coordDeltas.dx >= 0 ? '+' : ''}{profile.coordDeltas.dx.toFixed(1)}</span>
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                <span className="text-[10px] text-amber-300/60">ΔY</span>
                <span className="text-xs font-mono text-amber-200">{profile.coordDeltas.dy >= 0 ? '+' : ''}{profile.coordDeltas.dy.toFixed(1)}</span>
              </span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-pink-500/10 border border-pink-500/20">
                <span className="text-[10px] text-pink-300/60">ΔZ</span>
                <span className="text-xs font-mono text-pink-200">{profile.coordDeltas.dz >= 0 ? '+' : ''}{profile.coordDeltas.dz.toFixed(1)}</span>
              </span>
            </div>
        }
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Metric label="ΔX Separation" value={profile.deltaX.toFixed(1)} />
            <Metric label="ΔY Erosion" value={profile.deltaYErosion.toFixed(1)} />
            <Metric label="Vividness Δ" value={profile.vividnessShift.toFixed(1)} />
            <Metric label="Vector Dist" value={profile.vectorDistance.toFixed(1)} />
            {profile.pathScore != null &&
          <Metric label="Link Strength" value={profile.pathScore} unit="/100" />
          }
            <Metric label="|White| A→B" value={`${profile.distFromWhite_A.toFixed(0)}→${profile.distFromWhite_B.toFixed(0)}`} />
            <Metric label="|Black| A→B" value={`${profile.distFromBlack_A.toFixed(0)}→${profile.distFromBlack_B.toFixed(0)}`} />
            {profile.anchorAlignment && profile.anchorAlignment.shared && profile.anchorAlignment.cosine != null &&
              <div className="flex flex-col items-center px-2.5 py-1 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                <span className="text-[10px] uppercase tracking-wider text-indigo-300/50">Trajectory</span>
                <span className="text-xs font-mono text-indigo-200">{profile.anchorAlignment.label}</span>
                <span className="text-[9px] text-indigo-300/40 font-mono">{(profile.anchorAlignment.cosine * 100).toFixed(0)}% aligned</span>
              </div>
            }
          </div>
          {profile.closestClimate &&
        <div className="flex items-center gap-1.5 text-xs text-white/50">
              <span>Midpoint climate:</span>
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: profile.closestClimate.node.hex }} />
                <span className="text-white/70">{profile.closestClimate.node.name}</span>
                <span className="text-white/30 font-mono">({profile.closestClimate.distance.toFixed(1)})</span>
              </span>
            </div>
        }
          <div className={`flex items-center gap-1.5 text-xs ${profile.validation.valid ? 'text-emerald-400/70' : 'text-amber-400/80'}`}>
            {profile.validation.valid ?
          <><CheckCircle2 className="w-3.5 h-3.5" /> Vector geometry validated</> :
          <><AlertTriangle className="w-3.5 h-3.5" /> {profile.validation.reason}</>}
          </div>
        </div>
      }

      {/* Sequence chips */}
      {pathSequence && pathSequence.length > 1 &&
      <div className="flex items-center gap-1.5 px-4 py-2 bg-[#16161F]/90 backdrop-blur-xl border border-white/5 rounded-2xl overflow-x-auto max-w-full scrollbar-thin">
          {pathSequence.map((n, i) =>
        <React.Fragment key={n.id}>
              {i > 0 && <span className="text-white/20 text-xs shrink-0">→</span>}
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 whitespace-nowrap shrink-0">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: n.hex }} />
                <span className="text-xs text-white/70">{n.name}</span>
              </span>
            </React.Fragment>
        )}
        </div>
      }

      {/* Controls */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#16161F]/90 backdrop-blur-xl border border-white/5 rounded-full shadow-2xl">
        








        
        {pathMode &&
        <>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-2">
              {epNodes.length === 0 && <span className="text-xs text-white/40">Select first node</span>}
              {epNodes.length >= 1 &&
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: epNodes[0].hex }} />
                  <span className="text-xs text-white/70">{epNodes[0].name}</span>
                </span>
            }
              {epNodes.length >= 2 &&
            <>
                  <span className="text-white/20 text-xs">→</span>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: epNodes[1].hex }} />
                    <span className="text-xs text-white/70">{epNodes[1].name}</span>
                  </span>
                </>
            }
              {epNodes.length === 1 && <span className="text-xs text-white/40">Select second node</span>}
            </div>
            {epNodes.length === 2 &&
          <Button size="sm" onClick={onTrace} className="bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 rounded-full">
                <Play className="w-3.5 h-3.5 mr-1" />Trace
              </Button>
          }
            {(epNodes.length > 0 || pathSequence) &&
          <button onClick={onClear} className="text-white/30 hover:text-white transition-colors px-1">
                <X className="w-4 h-4" />
              </button>
          }
          </>
        }
      </div>
    </div>);

}