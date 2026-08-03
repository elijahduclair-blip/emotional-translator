import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles, Cake, Palette, Shapes, Compass, UserPlus, ArrowLeft, MessageCircle, Library, Clock } from 'lucide-react';
import moment from 'moment';
import PersonaLibrarianChat from '@/components/agents/PersonaLibrarianChat';
import PersonaSelector from '@/components/graph/PersonaSelector';
import PersonaVisualsPanel from '@/components/graph/PersonaVisualsPanel';
import TraitPromotionPanel from '@/components/graph/TraitPromotionPanel';
import ShapeVelocityPanel from '@/components/graph/ShapeVelocityPanel';
import PersonaNameEditor from '@/components/graph/PersonaNameEditor';
import TraitBadge from '@/components/graph/TraitBadge';
import AttributeTooltip from '@/components/graph/AttributeTooltip';
import { useAttributeTraits } from '@/hooks/useAttributeTraits';
import { useLibrarianTheme } from '@/hooks/useLibrarianTheme';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { usePersonaData } from '@/hooks/usePersonaData';
import { useQueryClient } from '@tanstack/react-query';

const SHAPE_SVGS = {
  'Square': <svg viewBox="0 0 40 40" className="w-5 h-5"><rect x="8" y="8" width="24" height="24" fill="currentColor" /></svg>,
  'Rectangle': <svg viewBox="0 0 40 40" className="w-5 h-5"><rect x="4" y="12" width="32" height="16" fill="currentColor" /></svg>,
  'Parallelogram': <svg viewBox="0 0 40 40" className="w-5 h-5"><polygon points="12,8 36,8 28,32 4,32" fill="currentColor" /></svg>,
  'Trapezoid': <svg viewBox="0 0 40 40" className="w-5 h-5"><polygon points="10,8 30,8 36,32 4,32" fill="currentColor" /></svg>,
  'Rhombus': <svg viewBox="0 0 40 40" className="w-5 h-5"><polygon points="20,4 36,20 20,36 4,20" fill="currentColor" /></svg>,
  'Kite': <svg viewBox="0 0 40 40" className="w-5 h-5"><polygon points="20,4 30,16 20,36 10,16" fill="currentColor" /></svg>,
  'Irregular': <svg viewBox="0 0 40 40" className="w-5 h-5"><polygon points="6,10 24,6 34,18 28,32 12,30 4,22" fill="currentColor" /></svg>,
};

function seasonOf(dateStr) {
  if (!dateStr) return '';
  const m = new Date(dateStr).getMonth() + 1;
  if (m >= 3 && m <= 5) return 'Spring';
  if (m >= 6 && m <= 8) return 'Summer';
  if (m >= 9 && m <= 11) return 'Autumn';
  return 'Winter';
}

function ProfileCard({ profile, onProfileUpdated }) {
  const { traits, loading } = useAttributeTraits(profile);

  return (
    <div
      className="rounded-3xl p-7 relative"
      style={{
        background: 'linear-gradient(135deg, #FCEADD 0%, #F5D3C2 100%)',
        boxShadow: '0 8px 40px rgba(120, 100, 80, 0.12)',
        fontFamily: 'EB Garamond, serif',
      }}
    >
      <div className="pb-4">
        <PersonaNameEditor profile={profile} onUpdated={onProfileUpdated} />
      </div>

      <div className="flex items-center gap-3 py-4 border-t border-[#DBC6B8]">
        <Cake className="w-4 h-4 text-[#A9866F] shrink-0" />
        <span className="text-sm font-semibold text-[#2A2726]">Birthday</span>
        <div className="flex items-center gap-2 ml-auto">
          {seasonOf(profile.birthday) ? (
            <AttributeTooltip
              label={`${seasonOf(profile.birthday)} · ${profile.birthday}`}
              traits={traits[seasonOf(profile.birthday)] || []}
              loading={loading}
              profileId={profile.id}
            >
              <span className="text-sm text-[#2A2726]">{profile.birthday}</span>
              <span className="text-xs px-2.5 py-0.5 bg-[#A9866F] text-white rounded-full">{seasonOf(profile.birthday)}</span>
            </AttributeTooltip>
          ) : (
            <span className="text-sm text-[#2A2726]">{profile.birthday || '—'}</span>
          )}
        </div>
      </div>

      {profile.archetype && (
        <div className="flex items-center gap-3 py-4 border-t border-[#DBC6B8]">
          <Compass className="w-4 h-4 text-[#A9866F] shrink-0" />
          <span className="text-sm font-semibold text-[#2A2726]">Archetype</span>
          <span className="text-sm text-[#2A2726] ml-auto">{profile.archetype}</span>
        </div>
      )}

      <div className="flex items-start gap-3 py-4 border-t border-[#DBC6B8]">
        <Palette className="w-4 h-4 text-[#A9866F] shrink-0 mt-0.5" />
        <span className="text-sm font-semibold text-[#2A2726]">Colors</span>
        <div className="flex flex-wrap gap-1.5 ml-auto justify-end">
          {(profile.fav_colors || []).length === 0 && <span className="text-xs text-[#2A2726]/30">—</span>}
          {(profile.fav_colors || []).map((c, i) => (
            <AttributeTooltip key={i} label={c} traits={traits[c] || []} loading={loading} profileId={profile.id}>
              <div className="w-6 h-6 rounded-full" style={{ backgroundColor: c }} />
            </AttributeTooltip>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 py-4 border-t border-[#DBC6B8]">
        <Shapes className="w-4 h-4 text-[#A9866F] shrink-0 mt-0.5" />
        <span className="text-sm font-semibold text-[#2A2726]">Shapes</span>
        <div className="flex flex-wrap gap-1.5 ml-auto justify-end">
          {(profile.fav_shapes || []).length === 0 && <span className="text-xs text-[#2A2726]/30">—</span>}
          {(profile.fav_shapes || []).map((s, i) => (
            <AttributeTooltip key={i} label={s} traits={traits[s] || []} loading={loading} profileId={profile.id}>
              <span className="flex items-center gap-1 text-xs text-[#2A2726] bg-[#D3BDB1]/50 px-2.5 py-1 rounded-full">
                <span className="text-[#A9866F]">{SHAPE_SVGS[s]}</span> {s}
              </span>
            </AttributeTooltip>
          ))}
        </div>
      </div>

      {(profile.semantic_labels || []).length > 0 && (
        <div className="py-4 border-t border-[#DBC6B8]">
          <p className="text-sm font-semibold text-[#2A2726] mb-2">Semantic label traits</p>
          <div className="flex flex-wrap gap-1.5">
            {profile.semantic_labels.map((l, i) => (
              <TraitBadge key={i} trait={l} profileId={profile.id} />
            ))}
          </div>
        </div>
      )}

      {profile.last_accessed_at && (
        <div className="flex items-center gap-1.5 pt-4 border-t border-[#DBC6B8] text-[11px] text-[#A9866F]">
          <Clock className="w-3 h-3" />
          Last accessed {moment(profile.last_accessed_at).fromNow()}
        </div>
      )}
    </div>
  );
}

export default function PersonaDashboard() {
  const { theme } = useLibrarianTheme();
  const queryClient = useQueryClient();
  const { profiles, domains, activeNodes, refetch } = usePersonaData();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('profile');
  const setSelectedId = useCallback((id) => {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('profile', id);
    else next.delete('profile');
    setSearchParams(next, { replace: !id });
  }, [searchParams, setSearchParams]);

  const handleSelectProfile = useCallback(async (id) => {
    setSelectedId(id);
    if (id) {
      const now = new Date().toISOString();
      await base44.entities.UserProfile.update(id, { last_accessed_at: now });
      queryClient.setQueryData(['persona-dashboard'], (old) => {
        if (!old) return old;
        return { ...old, profiles: old.profiles.map(p => p.id === id ? { ...p, last_accessed_at: now } : p) };
      });
    }
  }, [setSelectedId, queryClient]);
  const [activePersonaId, setActivePersonaId] = useState(null);

  const { pullDistance, refreshing } = usePullToRefresh(async () => { await refetch(); });

  const activeProfile = activePersonaId ? profiles?.find(p => p.id === activePersonaId) : null;

  const handleProfileUpdated = useCallback((updated) => {
    queryClient.setQueryData(['persona-dashboard'], (old) => {
      if (!old) return old;
      return { ...old, profiles: old.profiles.map(p => p.id === updated.id ? { ...p, ...updated } : p) };
    });
  }, [queryClient]);

  return (
    <div className="min-h-screen bg-[#0d140d] text-[#d4d4d4] p-6 pb-24" style={{ fontFamily: 'Inter, sans-serif', backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 60px, rgba(74,84,74,0.03) 60px, rgba(74,84,74,0.03) 120px), radial-gradient(ellipse at 50% 0%, rgba(197,179,88,0.04) 0%, transparent 50%)' }}>
      <div className="max-w-5xl mx-auto">
        <header className="mb-8 flex items-start justify-between relative">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-[#c5b358]/40 via-[#4a544a]/30 to-transparent" />
          <div className="pl-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-0 h-0" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '8px solid #c5b358' }} />
              <Sparkles className="w-5 h-5 text-[#c5b358]" />
              <h1 className="text-2xl font-semibold text-[#c5b358]" style={{ fontFamily: 'EB Garamond, serif', letterSpacing: '0.02em' }}>Persona Dashboard</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm text-[#4a544a]">How profile survey answers map to semantic coordinates.</p>
              <span title={theme.insight} className="flex items-center gap-1 text-[10px] px-2 py-0.5 bg-[#c5b358]/10 text-[#c5b358] border border-[#c5b358]/40 font-medium" style={{ fontFamily: 'EB Garamond, serif' }}>
                <Library className="w-2.5 h-2.5" /> {theme.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profiles && profiles.length > 0 && (
              <PersonaSelector profiles={profiles} selectedId={activePersonaId} onSelect={setActivePersonaId} />
            )}
            <Link to="/intro-profile" className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-[#c5b358]/10 text-[#c5b358] border border-[#c5b358]/40 transition-colors hover:bg-[#c5b358]/20" style={{ fontFamily: 'EB Garamond, serif' }}>
              <UserPlus className="w-4 h-4" /> New Profile
            </Link>
          </div>
        </header>

        {(pullDistance > 0 || refreshing) && (
          <div className="flex justify-center items-center overflow-hidden transition-all mb-4" style={{ height: Math.max(pullDistance, refreshing ? 32 : 0) }}>
            <Loader2 className={`w-5 h-5 text-[#4a544a] ${refreshing ? 'animate-spin' : ''}`} />
          </div>
        )}

        {profiles !== null && activeProfile && (
          <div className="mb-6">
            <PersonaVisualsPanel profile={activeProfile} domains={domains} />
          </div>
        )}

        {profiles === null ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#4a544a]" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="text-center py-20 space-y-3">
            <div className="flex justify-center mb-4">
              <div className="w-0 h-0" style={{ borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: '20px solid #c5b358' }} />
            </div>
            <p className="text-[#4a544a] text-sm" style={{ fontFamily: 'EB Garamond, serif' }}>No profiles yet.</p>
            <Link to="/intro-profile" className="inline-flex items-center gap-1.5 text-sm px-4 py-2 bg-[#c5b358] text-[#0d140d] transition-colors hover:bg-[#c5b358]/80" style={{ fontFamily: 'EB Garamond, serif' }}>
              <UserPlus className="w-4 h-4" /> Create your first profile
            </Link>
          </div>
        ) : selectedId ? (
          (() => {
            const selected = profiles.find(p => p.id === selectedId);
            if (!selected) return null;
            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <div className="space-y-4">
                  <button onClick={() => setSelectedId(null)} className="flex items-center gap-1.5 text-sm text-[#4a544a] hover:text-[#c5b358] mb-3 transition-colors" style={{ fontFamily: 'EB Garamond, serif' }}>
                    <ArrowLeft className="w-4 h-4" /> All profiles
                  </button>
                  <ProfileCard profile={selected} onProfileUpdated={handleProfileUpdated} />
                  <ShapeVelocityPanel profile={selected} />
                  <TraitPromotionPanel profile={selected} />
                </div>
                <PersonaLibrarianChat profile={selected} deferMs={800} />
              </div>
            );
          })()
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {profiles.map(p => (
              <div key={p.id} className="relative">
                <button
                  onClick={() => handleSelectProfile(p.id)}
                  className="absolute top-3 right-3 z-10 flex items-center gap-2 text-xs font-bold px-3.5 py-2 text-[#0d140d] hover:translate-x-[2px] hover:translate-y-[2px] transition-transform"
                  style={{
                    backgroundColor: '#c5b358',
                    border: '2px solid #0d140d',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0 0 #0d140d',
                    fontFamily: 'EB Garamond, serif',
                  }}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Ask Librarian
                  <Library className="w-3.5 h-3.5" />
                </button>
                <ProfileCard profile={p} onProfileUpdated={handleProfileUpdated} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}