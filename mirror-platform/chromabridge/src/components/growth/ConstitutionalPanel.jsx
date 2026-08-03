import React, { useMemo } from 'react';
import {
  ShieldCheck, Handshake, FileSearch, Scale,
} from 'lucide-react';

const LAWS = [
  {
    key: 'honesty',
    icon: ShieldCheck,
    title: 'Honesty',
    color: '#34D399',
    blurb: 'Every insight traces to evidence — no fabricated memory.',
  },
  {
    key: 'consent',
    icon: Handshake,
    title: 'Consent',
    color: '#FFB042',
    blurb: 'Structural growth passes through your explicit yes.',
  },
  {
    key: 'provenance',
    icon: FileSearch,
    title: 'Provenance',
    color: '#6C9EFF',
    blurb: 'Every node carries the history of how it arrived.',
  },
  {
    key: 'discipline',
    icon: Scale,
    title: 'Epistemic Discipline',
    color: '#A78BFA',
    blurb: 'Tier order and confidence thresholds are respected.',
  },
];

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 100);
}

function Bar({ label, value, max, color }) {
  const w = max ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="text-white/45 w-24 truncate capitalize">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: color }} />
      </div>
      <span className="text-white/60 w-6 text-right font-mono">{value}</span>
    </div>
  );
}

export default function ConstitutionalPanel({ concepts, discovery, nodes }) {
  const metrics = useMemo(() => {
    const totalC = concepts.length;
    const backed = concepts.filter((c) => (c.supporting_hypothesis_ids || []).length > 0).length;
    const contested = concepts.filter((c) => (c.active_conflict_ids || []).length > 0).length;
    const avgConfidence = totalC ? concepts.reduce((s, c) => s + (c.confidence || 0), 0) / totalC : 0;

    const accepted = discovery.filter((d) => d.status === 'accepted').length;
    const dismissed = discovery.filter((d) => d.status === 'dismissed').length;
    const pending = discovery.filter((d) => d.status === 'pending').length;
    const traitAuth = nodes.filter((n) => n.is_trait).length;

    const totalN = nodes.length;
    const provenant = nodes.filter((n) => n.insight && n.insight.trim()).length;

    const lifecycle = {};
    ['emerging', 'active', 'transitioning', 'superseded', 'archived'].forEach((s) => { lifecycle[s] = 0; });
    concepts.forEach((c) => {
      const s = c.lifecycle_status || 'emerging';
      lifecycle[s] = (lifecycle[s] || 0) + 1;
    });
    const avgStability = totalC ? concepts.reduce((s, c) => s + (c.stability || 0), 0) / totalC : 0;

    return {
      honesty: { backed, totalC, contested, avgConfidence },
      consent: { accepted, dismissed, pending, traitAuth },
      provenance: { provenant, totalN },
      discipline: { lifecycle, avgStability, avgConfidence, totalC },
    };
  }, [concepts, discovery, nodes]);

  const renderBody = (law) => {
    switch (law.key) {
      case 'honesty': {
        const m = metrics.honesty;
        return (
          <>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-2xl font-semibold" style={{ color: law.color }}>{pct(m.backed, m.totalC)}%</span>
              <span className="text-xs text-white/35">evidence-backed concepts</span>
            </div>
            <Bar label="Backed" value={m.backed} max={m.totalC} color="#34D399" />
            <Bar label="Contested" value={m.contested} max={m.totalC} color="#F59E0B" />
            <p className="text-[10px] text-white/30 mt-2">Avg confidence {(m.avgConfidence * 100).toFixed(0)}%</p>
          </>
        );
      }
      case 'consent': {
        const m = metrics.consent;
        return (
          <>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-2xl font-semibold" style={{ color: law.color }}>{m.accepted + m.traitAuth}</span>
              <span className="text-xs text-white/35">authorizations granted</span>
            </div>
            <Bar label="Accepted" value={m.accepted} max={m.accepted + m.dismissed + m.pending} color="#FFB042" />
            <Bar label="Dismissed" value={m.dismissed} max={m.accepted + m.dismissed + m.pending} color="#F87171" />
            <Bar label="Awaiting" value={m.pending} max={m.accepted + m.dismissed + m.pending} color="#94A3B8" />
            <p className="text-[10px] text-white/30 mt-2">{m.traitAuth} trait bridges promoted</p>
          </>
        );
      }
      case 'provenance': {
        const m = metrics.provenance;
        return (
          <>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-2xl font-semibold" style={{ color: law.color }}>{pct(m.provenant, m.totalN)}%</span>
              <span className="text-xs text-white/35">nodes carry provenance</span>
            </div>
            <Bar label="With insight" value={m.provenant} max={m.totalN} color="#6C9EFF" />
            <Bar label="Missing" value={m.totalN - m.provenant} max={m.totalN} color="#475569" />
            <p className="text-[10px] text-white/30 mt-2">{m.totalN} total personal nodes</p>
          </>
        );
      }
      case 'discipline': {
        const m = metrics.discipline;
        const max = Math.max(1, ...Object.values(m.lifecycle));
        return (
          <>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-2xl font-semibold" style={{ color: law.color }}>{(m.avgStability * 100).toFixed(0)}%</span>
              <span className="text-xs text-white/35">avg concept stability</span>
            </div>
            {Object.entries(m.lifecycle).map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={max} color="#A78BFA" />
            ))}
          </>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#16161F] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Scale className="w-4 h-4 text-amber-300" />
        <h2 className="text-sm font-semibold text-white/90">Constitutional Integrity</h2>
        <span className="ml-auto text-xs text-white/30">how the Mirror grows within its laws</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LAWS.map((law) => {
          const Icon = law.icon;
          return (
            <div key={law.key} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="w-4 h-4" style={{ color: law.color }} />
                <h3 className="text-sm font-semibold text-white/90">{law.title}</h3>
              </div>
              <p className="text-[11px] text-white/35 mb-3 leading-snug">{law.blurb}</p>
              {renderBody(law)}
            </div>
          );
        })}
      </div>
    </div>
  );
}