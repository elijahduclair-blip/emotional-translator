import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Save, ExternalLink, Loader2, Table2, UserX, AlertTriangle, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const purposes = [
  { value: 'concept_log', label: 'Concept Log' },
  { value: 'discovery_log', label: 'Discovery Log' },
];

function SyncStateDialog({ state, open, onOpenChange, onSave, saving }) {
  const [form, setForm] = useState({ sheet_id: '', sheet_url: '', purpose: 'concept_log' });

  useEffect(() => {
    if (state) {
      setForm({
        sheet_id: state.sheet_id || '',
        sheet_url: state.sheet_url || '',
        purpose: state.purpose || 'concept_log',
      });
    } else {
      setForm({ sheet_id: '', sheet_url: '', purpose: 'concept_log' });
    }
  }, [state, open]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-white max-w-md">
        <DialogHeader>
          <DialogTitle>{state ? 'Edit Sync Setting' : 'Add Sync Setting'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Google Sheet ID</Label>
            <Input
              value={form.sheet_id}
              onChange={e => set('sheet_id', e.target.value)}
              placeholder="e.g. 1A2B3C4D5E6F..."
              className="bg-background border-border"
            />
            <p className="text-xs text-white/30">The ID from your Google Sheet URL: docs.google.com/spreadsheets/d/<span className="text-white/50">[SHEET_ID]</span>/edit</p>
          </div>
          <div className="space-y-2">
            <Label>Sheet URL (optional)</Label>
            <Input
              value={form.sheet_url}
              onChange={e => set('sheet_url', e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="bg-background border-border"
            />
          </div>
          <div className="space-y-2">
            <Label>Connection Purpose</Label>
            <div className="flex gap-2">
              {purposes.map(p => (
                <button
                  key={p.value}
                  onClick={() => set('purpose', p.value)}
                  className={`px-3 py-1.5 rounded-full text-xs transition-colors border ${form.purpose === p.value ? 'bg-white/10 text-white border-white/20' : 'bg-white/5 text-white/40 border-transparent hover:text-white/60'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" className="text-white/60">Cancel</Button>
          </DialogClose>
          <Button onClick={() => onSave(form)} disabled={saving || !form.sheet_id.trim()}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SyncStateCard({ state, onEdit, onDelete }) {
  const purposeLabel = purposes.find(p => p.value === state.purpose)?.label || state.purpose;
  return (
    <div className="rounded-xl border border-white/10 bg-[#16161F] p-4 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <Table2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="font-mono text-sm text-white truncate">{state.sheet_id}</p>
            <p className="text-xs text-white/40 mt-0.5">{purposeLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {state.sheet_url && (
            <a href={state.sheet_url} target="_blank" rel="noopener noreferrer" className="p-2 text-white/40 hover:text-white rounded-md hover:bg-white/5">
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          <button onClick={() => onEdit(state)} className="p-2 text-white/40 hover:text-white rounded-md hover:bg-white/5">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => onDelete(state)} className="p-2 text-white/40 hover:text-red-400 rounded-md hover:bg-white/5">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SyncSettings() {
  const [states, setStates] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [dataSharing, setDataSharing] = useState(null);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    const all = await base44.entities.SyncState.list();
    setStates(all);
    try {
      const user = await base44.auth.me();
      setDataSharing(user.data_sharing === 'public' ? 'public' : 'private');
    } catch {
      setDataSharing('private');
    }
  };

  const toggleSharing = async (makePublic) => {
    const next = makePublic ? 'public' : 'private';
    setSavingPrivacy(true);
    try {
      await base44.auth.updateMe({ data_sharing: next });
      setDataSharing(next);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const { pullDistance, refreshing } = usePullToRefresh(load);

  const openAdd = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (state) => { setEditing(state); setDialogOpen(true); };

  const handleSave = async (form) => {
    setSaving(true);
    try {
      const payload = {
        sheet_id: form.sheet_id.trim(),
        sheet_url: form.sheet_url.trim(),
        purpose: form.purpose,
      };
      if (editing) {
        const updated = await base44.entities.SyncState.update(editing.id, payload);
        setStates(prev => prev.map(s => s.id === editing.id ? updated : s));
      } else {
        const created = await base44.entities.SyncState.create(payload);
        setStates(prev => [...prev, created]);
      }
      setDialogOpen(false);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await base44.entities.SyncState.delete(deleteTarget.id);
      setStates(prev => prev.filter(s => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6 pb-24">
      <div className="max-w-3xl mx-auto">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Sync Settings</h1>
            <p className="text-sm text-white/40 mt-1">Manage your Google Sheets integration, sheet IDs, and connection purposes.</p>
          </div>
          <Button onClick={openAdd} className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20">
            <Plus className="w-4 h-4 mr-1.5" /> Add
          </Button>
        </header>

        {(pullDistance > 0 || refreshing) && (
          <div className="flex justify-center items-center overflow-hidden transition-all mb-4" style={{ height: Math.max(pullDistance, refreshing ? 32 : 0) }}>
            <Loader2 className={`w-5 h-5 text-white/40 ${refreshing ? 'animate-spin' : ''}`} />
          </div>
        )}

        {states === null ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-white/30" />
          </div>
        ) : states.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-sm border border-dashed border-white/10 rounded-xl">
            <Table2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            No sync settings configured. Click "Add" to connect a Google Sheet.
          </div>
        ) : (
          <div className="space-y-3">
            {states.map(state => (
              <SyncStateCard key={state.id} state={state} onEdit={openEdit} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}

        {/* Privacy / Data Sharing */}
        <div className="mt-8 rounded-xl border border-white/10 bg-[#16161F] p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
              {dataSharing === 'public' ? <Eye className="w-5 h-5 text-indigo-400" /> : <EyeOff className="w-5 h-5 text-indigo-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-white/90">Data Privacy</h2>
                <Switch
                  checked={dataSharing === 'public'}
                  disabled={dataSharing === null || savingPrivacy}
                  onCheckedChange={(checked) => toggleSharing(checked)}
                />
              </div>
              <p className="text-xs text-white/40 mt-1">
                {dataSharing === 'public'
                  ? 'Your persona and graph data is viewable by others.'
                  : 'Your persona and graph data is private — only you can see it.'}
              </p>
            </div>
          </div>
        </div>

        {/* Account Deletion */}
        <div className="mt-8 rounded-xl border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
              <UserX className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-white/90">Account Deletion</h2>
              <p className="text-xs text-white/40 mt-1">Permanently delete your account and sign out. This action requires confirmation.</p>
              <button
                onClick={() => setDeleteAccountOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium px-3.5 py-2 rounded-lg bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      <SyncStateDialog
        state={editing}
        open={dialogOpen}
        onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditing(null); }}
        onSave={handleSave}
        saving={saving}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="bg-card border-border text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Sync Setting</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-white/60">
            Remove the Google Sheets sync for <span className="font-mono text-white">{deleteTarget?.sheet_id}</span>?
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" className="text-white/60">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account Deletion validation dialog */}
      <Dialog open={deleteAccountOpen} onOpenChange={(open) => { setDeleteAccountOpen(open); if (!open) setConfirmText(''); }}>
        <DialogContent className="bg-card border-border text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              Delete Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-white/60">
              This will permanently remove your access. To confirm, type <span className="font-mono font-semibold text-red-300">DELETE</span> below.
            </p>
            <Input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="bg-background border-border"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" className="text-white/60">Cancel</Button>
            </DialogClose>
            {deleteError && (
              <p className="text-xs text-red-400">{deleteError}</p>
            )}
            <Button
              variant="destructive"
              disabled={confirmText !== 'DELETE' || deletingAccount}
              onClick={async () => {
                setDeletingAccount(true);
                setDeleteError(null);
                try {
                  const user = await base44.auth.me();
                  const profiles = await base44.entities.UserProfile.filter({ created_by_id: user.id });
                  await Promise.all(profiles.map(p => base44.entities.UserProfile.delete(p.id)));
                  await base44.entities.User.delete(user.id);
                  await base44.auth.logout('/');
                } catch (e) {
                  setDeleteError(e.response?.data?.message || e.message || 'Failed to delete account.');
                  setDeletingAccount(false);
                }
              }}
            >
              {deletingAccount ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <UserX className="w-4 h-4 mr-1.5" />}
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}