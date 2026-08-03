import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

const ANCHORS = [
  { name: 'protect', x: 140, y: 170, z: 220, r: 0x5C, g: 0x6B, b: 0xC0 },
  { name: 'danger',  x: 160, y: 100, z: -150, r: 0xEF, g: 0x53, b: 0x50 },
  { name: 'hope',    x: -120, y: 180, z: 160, r: 0xFF, g: 0xD5, b: 0x4F },
  { name: 'shadow',  x: -180, y: 60, z: -180, r: 0x3A, g: 0x3A, b: 0x4A },
  { name: 'light',   x: 120, y: 240, z: 150, r: 0xFF, g: 0xF5, b: 0x9D },
  { name: 'growth',  x: 160, y: 210, z: 200, r: 0x66, g: 0xBB, b: 0x6A },
  { name: 'fear',    x: -140, y: 90, z: -200, r: 0x7E, g: 0x57, b: 0xC2 },
  { name: 'trust',   x: -100, y: 170, z: -120, r: 0x42, g: 0xA5, b: 0xF5 },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { word } = await req.json();
    if (!word || typeof word !== 'string') {
      return Response.json({ error: 'word is required' }, { status: 400 });
    }

    const anchorNames = ANCHORS.map(a => a.name);

    const similarities = await base44.integrations.Core.InvokeLLM({
      prompt: `Given the word "${word}", rate its semantic similarity (0.0 to 1.0) to each of these 8 concepts based on WordNet semantic relationships (synset path distance, shared hypernyms, antonymy, and semantic field overlap).\n\nConcepts: ${anchorNames.join(', ')}\n\nReturn a JSON object with each concept name as a key and the similarity score (0.0-1.0) as the value. Use 0.0 for no relationship and 1.0 for direct synonymy.`,
      response_json_schema: {
        type: 'object',
        properties: {
          protect: { type: 'number' },
          danger: { type: 'number' },
          hope: { type: 'number' },
          shadow: { type: 'number' },
          light: { type: 'number' },
          growth: { type: 'number' },
          fear: { type: 'number' },
          trust: { type: 'number' },
        },
      },
    });

    let totalWeight = 0;
    let x = 0, y = 0, z = 0;
    let r = 0, g = 0, b = 0;

    ANCHORS.forEach(anchor => {
      const score = similarities[anchor.name] || 0;
      if (score <= 0) return;
      totalWeight += score;
      x += score * anchor.x;
      y += score * anchor.y;
      z += score * anchor.z;
      r += score * anchor.r;
      g += score * anchor.g;
      b += score * anchor.b;
    });

    if (totalWeight === 0) {
      return Response.json({ x: 0, y: 127, z: 0, hex: '#888888' });
    }

    x = x / totalWeight;
    y = y / totalWeight;
    z = z / totalWeight;
    r = Math.round(r / totalWeight);
    g = Math.round(g / totalWeight);
    b = Math.round(b / totalWeight);
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

    return Response.json({ x, y, z, hex });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});