import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Eye, GitBranch, CheckCircle2, AlertTriangle, TrendingUp, Send, Shield } from 'lucide-react';
import moment from 'moment';

const STATUS_STYLES = {
  observed: { color: '#6b7280', label: 'Observed' },
  interpreted: { color: '#3b82f6', label: 'Interpreted' },
  candidate: { color: '#8b5cf6', label: 'Candidate' },
  contested: { color: '#ef4444', label: 'Contested' },
  supported: { color: '#10b981', label: 'Supported' },
  persistent: { color: '#c5b358', label: 'Persistent' },
  historical: { color: '#6b7280', label: 'Historical' },
  archived: { color: '#4b5563', label: 'Archived' },
};

const CATEGORY_COLORS = {
  identity: '#ef4444',
  preference: '#10b981',
  goal: '#3b82f6',
  belief: '#8b5cf6',
  habit: '#f59e0b',
  emotion: '#ec4899',
  relationship: '#06b6d4',
  worldview: '#6366f1',
};

function ConfidenceBar({ hypothesis }) {
  const dims = [
    { label: 'Interp', value: hypothesis.interpretation_confidence, weight: 0.15 },
    { label: 'Source', value: hypothesis.source_reliability, weight: 0.10 },
    { label: 'Cross-Ctx', value: hypothesis.cross_context_consistency, weight: 0.25 },
    { label: 'Repeat', value: hypothesis.repetition_strength, weight: 0.10 },
    { label: 'Temporal', value: hypothesis.temporal_stability, weight: 0.20 },
    { label: 'Conflict', value: hypothesis.contradiction_pressure, weight: -0.25 },
    { label: 'User Conf', value: hypothesis.user_confirmation_strength, weight: 0.25 },
  ];

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${hypothesis.aggregate_confidence * 100}%`, backgroundColor: STATUS_STYLES[hypothesis.status]?.color || '#6b7280' }}
          />
        </div>
        <span className="text-xs font-mono text-[#d4d4d4] w-10 text-right">{(hypothesis.aggregate_confidence * 100).toFixed(0)}%</span>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dims.map((d) => (
          <div key={d.label} className="text-center">
            <div className="h-8 bg-white/5 rounded-sm overflow-hidden flex flex-col-reverse">
              <div
                className="transition-all"
                style={{
                  height: `${Math.max(0, d.value) * 100}%`,
                  backgroundColor: d.weight < 0 ? '#ef4444' : '#4a544a',
                  opacity: d.value > 0 ? 0.8 : 0.2,
                }}
              />
            </div>
            <span className="text-[8px] text-[#4a544a] block mt-0.5">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EpistemicLab() {
  const [observation, setObservation] = useState('');
  const [sourceType, setSourceType] = useState('direct_statement');
  const [profileId, setProfileId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [hypotheses, setHypotheses] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promotingId, setPromotingId] = useState(null);
  const [promotionResult, setPromotionResult] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [hyps, ev, conc] = await Promise.all([
        base44.entities.SemanticHypothesis.list('-last_evaluated_at', 50),
        base44.entities.EvidenceRecord.list('-observed_at', 50),
        base44.entities.PersistentConcept.list('-updated_date', 50),
      ]);
      setHypotheses(hyps || []);
      setEvidence(ev || []);
      setConcepts(conc || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSubmit = async () => {
    if (!observation.trim() || !profileId.trim()) return;
    setSubmitting(true);
    setPromotionResult(null);
    try {
      const res = await base44.functions.invoke('observeAndHypothesize', {
        content: observation.trim(),
        source_type: sourceType,
        profile_id: profileId.trim(),
      });
      setLastResult(res.data);
      setObservation('');
      await loadAll();
    } catch (e) {
      setLastResult({ error: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromote = async (hypothesisId) => {
    setPromotingId(hypothesisId);
    setPromotionResult(null);
    try {
      const res = await base44.functions.invoke('promoteHypothesis', {
        hypothesis_id: hypothesisId,
      });
      setPromotionResult(res.data);
      if (res.data?.promoted) {
        await loadAll();
      }
    } catch (e) {
      setPromotionResult({ error: e.message });
    } finally {
      setPromotingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0d140d] text-[#d4d4d4] p-6 pb-24" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="mb-8 flex items-start justify-between">
          <div className="pl-4 border-l border-[#c5b358]/30">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-[#c5b358]" />
              <h1 className="text-2xl font-semibold text-[#c5b358]" style={{ fontFamily: 'EB Garamond, serif' }}>
                Epistemic Lab
              </h1>
            </div>
            <p className="text-sm text-[#4a544a]">
              Observation → Hypothesis → Evidence → Persistent State
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-[#4a544a]">
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {evidence.length} evidence</span>
            <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {hypotheses.length} hypotheses</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {concepts.length} concepts</span>
          </div>
        </header>

        {/* Observation Input */}
        <div className="rounded-2xl border border-[#4a544a]/40 bg-[#0d140d] p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Send className="w-4 h-4 text-[#c5b358]" />
            <h2 className="text-sm font-semibold text-[#c5b358]" style={{ fontFamily: 'EB Garamond, serif' }}>
              Submit Observation
            </h2>
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="bg-[#1a2a1a] border border-[#4a544a]/40 text-[#d4d4d4] text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-[#c5b358]/50"
              >
                <option value="direct_statement">Direct Statement</option>
                <option value="reported_behavior">Reported Behavior</option>
                <option value="observed_behavior">Observed Behavior</option>
                <option value="explicit_correction">Explicit Correction</option>
                <option value="external_record">External Record</option>
              </select>
              <input
                type="text"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                placeholder="Profile ID"
                className="flex-1 bg-[#1a2a1a] border border-[#4a544a]/40 text-[#d4d4d4] text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#c5b358]/50"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="What was observed..."
                className="flex-1 bg-[#1a2a1a] border border-[#4a544a]/40 text-[#d4d4d4] text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-[#c5b358]/50"
              />
              <button
                onClick={handleSubmit}
                disabled={submitting || !observation.trim() || !profileId.trim()}
                className="px-4 py-2.5 bg-[#c5b358] text-[#0d140d] text-sm font-semibold rounded-lg disabled:opacity-30 hover:bg-[#c5b358]/80 transition-colors flex items-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Observe
              </button>
            </div>
          </div>
        </div>

        {/* Promotion Result */}
        {promotionResult && (
          <div className={`rounded-xl border p-3 mb-4 text-xs ${promotionResult.promoted ? 'border-[#10b981]/40 bg-[#10b981]/5 text-[#10b981]' : 'border-[#ef4444]/40 bg-[#ef4444]/5 text-[#ef4444]'}`}>
            {promotionResult.promoted ? (
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Promoted to persistent concept: {promotionResult.concept?.proposition}</span>
            ) : (
              <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Not promoted: {promotionResult.reason?.replace(/_/g, ' ')} (confidence {((promotionResult.current || 0) * 100).toFixed(0)}% vs threshold {((promotionResult.threshold || 0) * 100).toFixed(0)}%)</span>
            )}
          </div>
        )}

        {/* Hypotheses */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-[#c5b358]" />
            <h2 className="text-sm font-semibold text-[#c5b358]" style={{ fontFamily: 'EB Garamond, serif' }}>
              Hypothesis Layer
            </h2>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#4a544a]" /></div>
          ) : hypotheses.length === 0 ? (
            <p className="text-xs text-[#4a544a] text-center py-8">No hypotheses yet. Submit an observation to begin.</p>
          ) : (
            <div className="space-y-3">
              {hypotheses.map((h) => {
                const style = STATUS_STYLES[h.status] || STATUS_STYLES.observed;
                const catColor = CATEGORY_COLORS[h.category] || '#6b7280';
                return (
                  <div key={h.id} className="rounded-xl border border-[#4a544a]/30 bg-[#1a2a1a] p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#d4d4d4]">{h.proposition}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: catColor + '20', color: catColor }}>
                            {h.category}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: style.color + '20', color: style.color }}>
                            {style.label}
                          </span>
                          <span className="text-[9px] text-[#4a544a]">{(h.supporting_evidence_ids || []).length} supporting</span>
                          {(h.counter_evidence_ids || []).length > 0 && (
                            <span className="text-[9px] text-[#ef4444]">{(h.counter_evidence_ids || []).length} counter</span>
                          )}
                          {h.last_evaluated_at && (
                            <span className="text-[9px] text-[#4a544a]">{moment(h.last_evaluated_at).fromNow()}</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handlePromote(h.id)}
                        disabled={promotingId === h.id || h.status === 'persistent'}
                        className="text-[10px] px-2.5 py-1 rounded-lg border border-[#c5b358]/30 text-[#c5b358] hover:bg-[#c5b358]/10 disabled:opacity-30 transition-colors whitespace-nowrap"
                      >
                        {promotingId === h.id ? <Loader2 className="w-3 h-3 animate-spin" /> : h.status === 'persistent' ? 'Persistent' : 'Evaluate'}
                      </button>
                    </div>
                    <ConfidenceBar hypothesis={h} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Persistent Concepts */}
        {concepts.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-[#c5b358]" />
              <h2 className="text-sm font-semibold text-[#c5b358]" style={{ fontFamily: 'EB Garamond, serif' }}>
                Persistent Concepts
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {concepts.map((c) => (
                <div key={c.id} className="rounded-xl border border-[#c5b358]/20 bg-[#1a2a1a] p-3">
                  <p className="text-sm text-[#c5b358]">{c.proposition}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.category] + '20', color: CATEGORY_COLORS[c.category] }}>{c.category}</span>
                    <span className="text-[9px] text-[#4a544a]">{(c.confidence * 100).toFixed(0)}% confidence</span>
                    <span className="text-[9px] text-[#4a544a]">{c.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence Log */}
        {evidence.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-[#c5b358]" />
              <h2 className="text-sm font-semibold text-[#c5b358]" style={{ fontFamily: 'EB Garamond, serif' }}>
                Evidence Log
              </h2>
            </div>
            <div className="space-y-1.5">
              {evidence.slice(0, 10).map((e) => (
                <div key={e.id} className="rounded-lg border border-[#4a544a]/20 bg-[#0d140d] px-3 py-2 flex items-center gap-3">
                  <span className="text-[9px] text-[#4a544a] font-mono whitespace-nowrap">{moment(e.observed_at).fromNow()}</span>
                  <span className="text-[9px] text-[#4a544a] uppercase">{e.source_type?.replace(/_/g, ' ')}</span>
                  <span className="text-[9px] text-[#4a544a]">{e.temporality}</span>
                  <span className="text-xs text-[#d4d4d4]/70 truncate">{e.content}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}