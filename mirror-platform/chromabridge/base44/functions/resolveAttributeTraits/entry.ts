import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const ANCHOR_SYSTEM = `The ChromaBridge semantic anchor system uses these 8 canonical base anchors:
- Protect (vigilance, safety, guardianship)
- Danger (risk, threat, volatility)
- Hope (optimism, aspiration, forward-looking)
- Shadow (obfuscation, mystery, depth)
- Light (clarity, transparency, illumination)
- Growth (expansion, development, dynamism)
- Fear (anxiety, retreat, defensive)
- Trust (reliability, stability, structure)

Additionally, structural/cognitive trait labels may be used when more precise:
- Stability, Structure, Fluidity, Resonance, Precision, Adaptability, Intensity, Calm

Shape-Trait Categories (map each attribute to ONE of these):
- Stability (Square): consistency, rule-following, long-term planning
- Structure (Rectangle): logical sequencing, building, foundational thinking
- Balance (Rhombus): adaptability while maintaining core structure
- Movement (Parallelogram): curiosity, travel, desire for change
- Directionality (Trapezoid): goal-oriented focus, path-finding
- Complexity (Kite): multi-faceted interests, social complexity
- Uniqueness (Irregular): divergent thinking, creativity, unique problem-solving`;

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const attributes = body.attributes || [];
    if (attributes.length === 0) {
      return Response.json({ mappings: {} });
    }

    // Build a single LLM prompt to resolve all attributes at once
    const attrList = attributes.map((a, i) => `${i + 1}. [${a.type}] "${a.value}"`).join('\n');

    const llmRes = await base44.integrations.Core.InvokeLLM({
      prompt: `You are the Librarian for ChromaBridge, a semantic visualization tool that maps concepts onto a 3-axis color space (X = abstract↔concrete / cool↔warm, Y = general↔specific, Z = passive↔active).

${ANCHOR_SYSTEM}

For each of the following user profile attributes, do TWO things:
1. Map it to 2-3 semantic trait strings drawn from the anchor system above.
2. Assign it to exactly ONE shape-trait category from: Stability, Structure, Balance, Movement, Directionality, Complexity, Uniqueness.

Attributes to map:
${attrList}

Return a JSON object with a "results" array. Each element has:
- "attribute" (the exact value string)
- "traits" (array of 2-3 trait strings from the anchor system)
- "shape_trait" (exactly one of: Stability, Structure, Balance, Movement, Directionality, Complexity, Uniqueness)`,
      response_json_schema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                attribute: { type: 'string' },
                traits: { type: 'array', items: { type: 'string' } },
                shape_trait: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const mappings = {};
    const shapeTraits = {};
    for (const r of llmRes.results || []) {
      if (r.attribute && r.traits) {
        mappings[r.attribute] = r.traits;
      }
      if (r.attribute && r.shape_trait) {
        shapeTraits[r.attribute] = r.shape_trait;
      }
    }

    return Response.json({ mappings, shapeTraits });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}