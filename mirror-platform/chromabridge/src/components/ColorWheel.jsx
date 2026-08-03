import React, { useRef, useState, useCallback } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Convert HSL to hex */
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = v => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** Convert hex to HSL */
function hexToHsl(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: hue = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: hue = ((b - r) / d + 2); break;
      case b: hue = ((r - g) / d + 4); break;
    }
    hue *= 60;
  }
  return { h: hue, s: s * 100, l: l * 100 };
}

const WHEEL_SIZE = 220;
const INDICATOR = 14;

export default function ColorWheel({ colors, onChange }) {
  const wheelRef = useRef(null);
  // Start with a default hue if no colors yet
  const lastColor = colors[colors.length - 1] || '#3B82F6';
  const [hue, setHue] = useState(() => hexToHsl(lastColor).h);
  const [saturation, setSaturation] = useState(() => hexToHsl(lastColor).s);
  const [lightness, setLightness] = useState(50);

  const currentHex = hslToHex(hue, saturation, lightness);

  const handleWheelClick = useCallback((e) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = e.clientX - rect.left - cx;
    const dy = e.clientY - rect.top - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = rect.width / 2;
    // Conic gradient starts at top (0deg) going clockwise;
    // atan2 returns from positive x-axis, so offset by +90 to align.
    let angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    if (angle >= 360) angle -= 360;
    setHue(angle);
    // Saturation from distance: center = 0%, edge = 100%
    const sat = Math.min(100, Math.round((dist / maxDist) * 100));
    setSaturation(sat);
  }, []);

  const handleBrightness = (val) => {
    // 0 = darkest (10%), 100 = brightest (90%)
    setLightness(10 + (val / 100) * 80);
  };

  const brightnessValue = Math.round(((lightness - 10) / 80) * 100);

  const addColor = () => {
    onChange([...colors, currentHex]);
  };

  const removeColor = (idx) => {
    onChange(colors.filter((_, i) => i !== idx));
  };

  // Indicator position on the wheel
  // Indicator position: angle from top (0deg) clockwise, radius scaled by saturation
  const indicatorAngleRad = ((hue - 90) * Math.PI) / 180;
  const maxRadius = WHEEL_SIZE / 2 - INDICATOR / 2;
  const indicatorRadius = (saturation / 100) * maxRadius;
  const indicatorX = WHEEL_SIZE / 2 + Math.cos(indicatorAngleRad) * indicatorRadius - INDICATOR / 2;
  const indicatorY = WHEEL_SIZE / 2 + Math.sin(indicatorAngleRad) * indicatorRadius - INDICATOR / 2;

  return (
    <div className="space-y-4">
      {/* Color Wheel */}
      <div className="flex flex-col items-center gap-4">
        <div
          ref={wheelRef}
          onClick={handleWheelClick}
          className="relative rounded-full cursor-crosshair"
          style={{
            width: WHEEL_SIZE,
            height: WHEEL_SIZE,
            background: 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          }}
        >
          {/* Radial overlay: center = white (desaturated), edge = transparent (full saturation) */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, #ffffff 0%, rgba(255,255,255,0) 70%)',
            }}
          />
          {/* Indicator */}
          <div
            className="absolute rounded-full border-2 border-white shadow-lg pointer-events-none"
            style={{
              width: INDICATOR,
              height: INDICATOR,
              left: indicatorX,
              top: indicatorY,
              backgroundColor: currentHex,
            }}
          />
        </div>

        {/* Current color + brightness */}
        <div className="flex items-center gap-3 w-full max-w-[220px]">
          <div
            className="w-10 h-10 rounded-lg border border-white/20 shrink-0"
            style={{ backgroundColor: currentHex }}
          />
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-white/50">Brightness</span>
              <span className="text-xs text-white/40 font-mono">{brightnessValue}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={brightnessValue}
              onChange={e => handleBrightness(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #000000, ${hslToHex(hue, saturation, 50)}, #ffffff)`,
              }}
            />
          </div>
        </div>

        <Button
          onClick={addColor}
          size="sm"
          className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-full"
        >
          <Plus className="w-4 h-4 mr-1" /> Add this color
        </Button>
      </div>

      {/* Selected colors */}
      {colors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/50">Selected colors ({colors.length})</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((color, idx) => (
              <div key={idx} className="relative group">
                <div
                  className="w-9 h-9 rounded-lg border border-white/20"
                  style={{ backgroundColor: color }}
                />
                <button
                  onClick={() => removeColor(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}