import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Pencil, Check, X } from 'lucide-react';

export default function PersonaNameEditor({ profile, onUpdated }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(profile.name || '');
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setValue(profile.name || '');
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setValue(profile.name || '');
  };

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === profile.name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await base44.entities.UserProfile.update(profile.id, { name: trimmed });
      onUpdated?.({ ...profile, name: trimmed });
    } catch (e) {
      // ignore
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center justify-center gap-2 -mt-1 mb-1">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') cancel();
          }}
          placeholder="Persona name…"
          disabled={saving}
          className="text-lg font-semibold bg-white/70 text-[#2A2726] border border-[#DBC6B8] rounded-lg px-2 py-0.5 outline-none focus:border-[#A9866F]"
          style={{ fontFamily: 'EB Garamond, serif', letterSpacing: '0.01em' }}
        />
        <button
          onClick={save}
          disabled={saving || !value.trim()}
          className="text-[#A68940] hover:text-[#4A3B2D] transition-colors disabled:opacity-30"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </button>
        <button onClick={cancel} disabled={saving} className="text-[#A9866F]/50 hover:text-[#2A2726] transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 group">
      <h3
        className="text-lg font-semibold text-[#2A2726]"
        style={{ fontFamily: 'EB Garamond, serif', letterSpacing: '0.01em' }}
      >
        {profile.name || 'Untitled Persona'}
      </h3>
      <button
        onClick={startEdit}
        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#A9866F]/60 hover:text-[#A9866F]"
        title="Edit name"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}