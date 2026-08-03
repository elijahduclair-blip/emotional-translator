import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RelationshipEditor({ title, items = [], badgeClass, onAdd, onRemove }) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    const trimmed = input.trim();
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed);
      setInput('');
    }
  };

  return (
    <div>
      <label className="text-xs uppercase tracking-wider text-white/40 mb-2 block">{title}</label>
      <div className="flex flex-wrap gap-2 mb-3">
        {(items || []).map(item => (
          <span key={item} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs ${badgeClass}`}>
            {item}
            <button onClick={() => onRemove(item)} className="text-white/30 hover:text-red-400 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {(!items || items.length === 0) && (
          <span className="text-xs text-white/30 italic">None yet</span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder={`Add ${title.toLowerCase()}…`}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/20"
        />
        <Button size="sm" variant="ghost" onClick={handleAdd} className="text-white/50 hover:text-white px-2">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}