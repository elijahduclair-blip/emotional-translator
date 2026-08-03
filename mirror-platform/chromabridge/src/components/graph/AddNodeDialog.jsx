import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import RgbHexEditor from '@/components/graph/RgbHexEditor';
import { ANCHOR_NAMES } from '@/components/graph/anchorSystem';

export default function AddNodeDialog({ open, onOpenChange, onAdd }) {
  const [form, setForm] = useState({ name: '', hex: '#8A8A93', labels: '', parents: '' });
  const [positioning, setPositioning] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({ name: '', hex: '#8A8A93', labels: '', parents: '' });
      setPositioning(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) return;
    setPositioning(true);
    try {
      await onAdd({
        name: form.name.trim(),
        hex: form.hex,
        semantic_labels: form.labels.split(',').map(l => l.trim()).filter(Boolean),
        parents: form.parents.split(',').map(l => l.trim()).filter(Boolean),
        tier: 'shade',
      });
      onOpenChange(false);
    } finally {
      setPositioning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#16161F] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Add Concept Node</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-white/60 text-xs">Concept Name</Label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Courage"
              className="bg-white/5 border-white/10 text-white mt-1"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>
          <div>
            <Label className="text-white/60 text-xs">Color (secondary — visual only)</Label>
            <div className="mt-1">
              <RgbHexEditor value={form.hex} onChange={hex => setForm(f => ({ ...f, hex }))} />
            </div>
          </div>
          <div className="text-xs text-white/40 bg-white/5 rounded-lg px-3 py-2.5 border border-white/10">
            Position auto-computed via WordNet semantic similarity to 8 concept anchors: {ANCHOR_NAMES.join(', ')}.
          </div>
          <div>
            <Label className="text-white/60 text-xs">Semantic Labels (comma-separated)</Label>
            <Input
              value={form.labels}
              onChange={e => setForm(f => ({ ...f, labels: e.target.value }))}
              placeholder="e.g. emotion, action, activation"
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white/60 text-xs">Parents (comma-separated, for hierarchy)</Label>
            <Input
              value={form.parents}
              onChange={e => setForm(f => ({ ...f, parents: e.target.value }))}
              placeholder="e.g. Trust, Protect"
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-white/50 hover:text-white">Cancel</Button>
          <Button onClick={handleSubmit} disabled={!form.name.trim() || positioning} className="bg-white/10 hover:bg-white/20 text-white border border-white/10">
            {positioning ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
            {positioning ? 'Locating…' : 'Add Node'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}