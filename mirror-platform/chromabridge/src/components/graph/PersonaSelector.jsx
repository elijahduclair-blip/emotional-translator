import React, { useState, useRef, useEffect } from 'react';
import { Users, ChevronDown, Check } from 'lucide-react';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';

export default function PersonaSelector({ profiles, selectedId, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMobile]);

  const selected = profiles?.find(p => p.id === selectedId);

  const handleSelect = (id) => {
    onSelect(id);
    setOpen(false);
  };

  const triggerButton = (
    <button
      onClick={() => setOpen(prev => !prev)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-colors ${
        selected
          ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
          : 'bg-white/5 text-white/50 border-white/10 hover:text-white/70'
      }`}
    >
      <Users className="w-3.5 h-3.5" />
      {selected ? selected.archetype : 'Persona'}
      <ChevronDown className="w-3 h-3" />
    </button>
  );

  const listItems = profiles && profiles.length > 0 ? (
    <>
      <button
        onClick={() => handleSelect(null)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-white/40 hover:bg-white/5 hover:text-white/60 transition-colors"
      >
        No persona
      </button>
      <div className="border-t border-white/5" />
      {profiles.map(p => (
        <button
          key={p.id}
          onClick={() => handleSelect(p.id)}
          className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition-colors hover:bg-white/5 ${
            selectedId === p.id ? 'text-indigo-300' : 'text-white/60'
          }`}
        >
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: (p.fav_colors || [])[0] || '#888' }} />
          <span className="truncate flex-1 text-left">{p.archetype || 'Unknown'}</span>
          <span className="text-[9px] text-white/30">{p.birthday}</span>
          {selectedId === p.id && <Check className="w-3 h-3 shrink-0" />}
        </button>
      ))}
    </>
  ) : (
    <div className="px-3 py-4 text-center text-xs text-white/30">No profiles yet</div>
  );

  if (isMobile) {
    return (
      <>
        {triggerButton}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="bg-card border-border safe-bottom">
            <div className="px-4 pb-6 pt-2">
              <div className="text-xs uppercase tracking-wider text-white/40 mb-2 px-1">Select Persona</div>
              <div className="max-h-[50vh] overflow-y-auto">
                {listItems}
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      {triggerButton}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-60 max-h-72 overflow-y-auto rounded-lg border border-white/10 bg-card shadow-xl z-50">
          {listItems}
        </div>
      )}
    </div>
  );
}