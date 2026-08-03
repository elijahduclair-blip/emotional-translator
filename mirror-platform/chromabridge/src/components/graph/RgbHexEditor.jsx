import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const channels = [
  { key: 'r', label: 'R', color: '#ef4444' },
  { key: 'g', label: 'G', color: '#22c55e' },
  { key: 'b', label: 'B', color: '#3b82f6' },
];

function clampHex(hex) {
  let h = (hex || '').replace('#', '').toUpperCase();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9A-F]{6}$/.test(h)) return null;
  return '#' + h;
}

function hexToRgb(hex) {
  const h = clampHex(hex);
  if (!h) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(1, 3), 16),
    g: parseInt(h.slice(3, 5), 16),
    b: parseInt(h.slice(5, 7), 16),
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => {
    const clamped = Math.max(0, Math.min(255, Math.round(v)));
    return clamped.toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

export default function RgbHexEditor({ value, onChange }) {
  const rgb = hexToRgb(value);

  const handleChannel = (channel, val) => {
    const next = { ...rgb, [channel]: Math.max(0, Math.min(255, val)) };
    onChange(rgbToHex(next.r, next.g, next.b));
  };

  const handleHex = (hex) => {
    onChange(hex);
  };

  const handleHexBlur = () => {
    const validated = clampHex(value);
    if (validated) onChange(validated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={clampHex(value) || '#000000'}
          onChange={e => onChange(e.target.value.toUpperCase())}
          className="w-10 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer flex-shrink-0"
        />
        <Input
          value={value}
          onChange={e => handleHex(e.target.value)}
          onBlur={handleHexBlur}
          className="bg-[#0E0E12] border-white/10 font-mono text-white"
          placeholder="#RRGGBB"
        />
        <div className="w-10 h-10 rounded-lg border border-white/10 flex-shrink-0" style={{ backgroundColor: clampHex(value) || '#000000' }} />
      </div>
      <div className="space-y-2">
        {channels.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-2.5">
            <Label className="text-xs font-mono w-3 text-center" style={{ color }}>{label}</Label>
            <input
              type="range"
              min="0"
              max="255"
              value={rgb[key]}
              onChange={e => handleChannel(key, Number(e.target.value))}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: color }}
            />
            <Input
              type="number"
              min="0"
              max="255"
              value={rgb[key]}
              onChange={e => handleChannel(key, Number(e.target.value))}
              className="bg-[#0E0E12] border-white/10 text-white w-16 text-center font-mono text-xs h-8"
            />
          </div>
        ))}
      </div>
    </div>
  );
}