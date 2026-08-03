import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Prompts for a name when the discovery engine suggests a missing intermediate
 * concept. Position and color are auto-derived from the midpoint of the two
 * candidate nodes — the user only names the new idea.
 */
export default function NewConceptDialog({ open, onOpenChange, candidate, onCreate }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  if (!candidate) return null;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onCreate(name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#16161F] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Name the missing concept</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-white/40">
            The geometry between{' '}
            <span className="text-white/70" style={{ color: candidate.nodeA.hex }}>{candidate.nodeA.name}</span>
            {' '}and{' '}
            <span className="text-white/70" style={{ color: candidate.nodeB.hex }}>{candidate.nodeB.name}</span>
            {' '}suggests an intermediate category that doesn't exist yet. The new node will be placed at their midpoint.
          </p>
          <div>
            <Label className="text-white/60 text-xs">Concept name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rose Gold, Warm Pastel…"
              className="bg-white/5 border-white/10 text-white mt-1"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/50 hover:text-white">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!name.trim()} className="bg-violet-500/20 hover:bg-violet-500/30 text-violet-300 border border-violet-500/30">Create concept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}