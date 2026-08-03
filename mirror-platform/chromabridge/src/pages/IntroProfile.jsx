import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Sparkles, Palette, Shapes, Cake, Compass, Loader2, User } from 'lucide-react';
import ColorWheel from '@/components/ColorWheel';

const SHAPES = ['Square', 'Rectangle', 'Parallelogram', 'Trapezoid', 'Rhombus', 'Kite', 'Irregular'];

const SHAPE_SVGS = {
  'Square': <svg viewBox="0 0 40 40" className="w-8 h-8"><rect x="8" y="8" width="24" height="24" fill="currentColor" /></svg>,
  'Rectangle': <svg viewBox="0 0 40 40" className="w-8 h-8"><rect x="4" y="12" width="32" height="16" fill="currentColor" /></svg>,
  'Parallelogram': <svg viewBox="0 0 40 40" className="w-8 h-8"><polygon points="12,8 36,8 28,32 4,32" fill="currentColor" /></svg>,
  'Trapezoid': <svg viewBox="0 0 40 40" className="w-8 h-8"><polygon points="10,8 30,8 36,32 4,32" fill="currentColor" /></svg>,
  'Rhombus': <svg viewBox="0 0 40 40" className="w-8 h-8"><polygon points="20,4 36,20 20,36 4,20" fill="currentColor" /></svg>,
  'Kite': <svg viewBox="0 0 40 40" className="w-8 h-8"><polygon points="20,4 30,16 20,36 10,16" fill="currentColor" /></svg>,
  'Irregular': <svg viewBox="0 0 40 40" className="w-8 h-8"><polygon points="6,10 24,6 34,18 28,32 12,30 4,22" fill="currentColor" /></svg>,
};

const ARCHETYPES = [
  {
    name: 'Analytical Architect',
    desc: 'Logical, focused on structural graph improvement.'
  },
  {
    name: 'Empathetic Mirror',
    desc: 'Focuses on emotional color shifts and personal growth.'
  },
  {
    name: 'Conceptual Explorer',
    desc: 'Focuses on finding new semantic connections unseen before.'
  }
];

export default function IntroProfile() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [favColors, setFavColors] = useState(['#3B82F6']);
  const [favShapes, setFavShapes] = useState([]);
  const [quadrilateral, setQuadrilateral] = useState('');
  const [archetype, setArchetype] = useState('');

  const toggleShape = (shape) => {
    setFavShapes(prev => {
      if (prev.includes(shape)) return prev.filter(s => s !== shape);
      if (prev.length >= 2) return prev;
      return [...prev, shape];
    });
  };

  const canProceed = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return !!birthday;
    if (step === 2) return favColors.length > 0;
    if (step === 3) return favShapes.length > 0;
    if (step === 4) return !!archetype;
    return false;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await base44.entities.UserProfile.create({
        name,
        birthday,
        fav_colors: favColors,
        fav_shapes: favShapes,
        archetype
      });
      navigate('/persona-interview');
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Failed to save profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const steps = ['Name', 'Birthday', 'Colors', 'Shapes', 'Lens'];

  return (
    <div className="safe-top min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-10 bg-indigo-400' : i < step ? 'w-6 bg-indigo-500/60' : 'w-6 bg-white/10'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 mb-6 justify-center">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h1 className="text-xl font-semibold">Map Your Semantic Self</h1>
        </div>

        <Card className="bg-card border-border p-6 space-y-5">
          {/* Step 0: Name */}
          {step === 0 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-base">
                <User className="w-4 h-4 text-indigo-400" /> Name this persona
              </Label>
              <p className="text-sm text-white/50">
                Give this persona profile a name — it helps you distinguish multiple profiles on your dashboard.
              </p>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. The Wanderer"
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          )}

          {/* Step 1: Birthday */}
          {step === 1 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-base">
                <Cake className="w-4 h-4 text-indigo-400" /> When were you born?
              </Label>
              <p className="text-sm text-white/50">
                Your birthday provides biographical context — generation, season, and temporal resonance —
                that shapes how the agent interprets your answers.
              </p>
              <Input
                type="date"
                value={birthday}
                onChange={e => setBirthday(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          )}

          {/* Step 2: Colors */}
          {step === 2 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-base">
                <Palette className="w-4 h-4 text-indigo-400" /> Pick your favorite colors
              </Label>
              <p className="text-sm text-white/50">
                These colors map to your semantic origin coordinates (X = cool↔warm, Y = luminance, Z = muted↔vivid).
              </p>
              <ColorWheel colors={favColors} onChange={setFavColors} />
            </div>
          )}

          {/* Step 3: Shapes */}
          {step === 3 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-base">
                <Shapes className="w-4 h-4 text-indigo-400" /> Which shapes resonate with you?
              </Label>
              <p className="text-sm text-white/50">
                Pick up to 2 — each applies a coordinate weighting that stretches or stabilizes your personal graph center.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SHAPES.map(shape => {
                  const selected = favShapes.includes(shape);
                  const disabled = !selected && favShapes.length >= 2;
                  return (
                    <button
                      key={shape}
                      onClick={() => toggleShape(shape)}
                      disabled={disabled}
                      className={`flex flex-col items-center gap-2 px-3 py-3 rounded-lg border text-sm transition-colors ${
                        selected
                          ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200'
                          : disabled
                            ? 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                            : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      <span className={selected ? 'text-indigo-200' : disabled ? 'text-white/20' : 'text-white/50'}>
                        {SHAPE_SVGS[shape]}
                      </span>
                      {shape}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 4: Archetype Lens */}
          {step === 4 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2 text-base">
                <Compass className="w-4 h-4 text-indigo-400" /> Which lens will you explore through?
              </Label>
              <p className="text-sm text-white/50">
                This choice is a semantic hint — it shapes how your personal AI agent will conduct follow-up
                conversations and refine your graph position.
              </p>
              <div className="space-y-2">
                {ARCHETYPES.map(a => (
                  <button
                    key={a.name}
                    onClick={() => setArchetype(a.name)}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                      archetype === a.name
                        ? 'bg-indigo-500/20 border-indigo-500/40'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{a.name}</span>
                      {archetype === a.name && <span className="text-indigo-300 text-xs">Selected</span>}
                    </div>
                    <p className="text-xs text-white/50 mt-0.5">{a.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="ghost"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0 || submitting}
              className="text-white/60 hover:text-white"
            >
              Back
            </Button>
            {step < steps.length - 1 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
                className="bg-indigo-500 hover:bg-indigo-600 text-white"
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!canProceed() || submitting}
                className="bg-indigo-500 hover:bg-indigo-600 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {submitting ? 'Saving…' : 'Complete Profile'}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}