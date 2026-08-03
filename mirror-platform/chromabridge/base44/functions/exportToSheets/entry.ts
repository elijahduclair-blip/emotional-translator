import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Fetch all color nodes (paginate past the 500 limit)
    const nodes = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.filter({}, '-created_date', 500, skip);
      nodes.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
    }

    // Sort by tier for grouping: base, bridge, shade, words
    const tierOrder = { base: 0, bridge: 1, shade: 2, words: 3 };
    nodes.sort((a, b) => (tierOrder[a.tier] ?? 4) - (tierOrder[b.tier] ?? 4) || a.name.localeCompare(b.name));

    // Create a new spreadsheet
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: `ChromaBridge Export ${new Date().toISOString().slice(0, 16).replace('T', ' ')}` },
        sheets: [{ properties: { title: 'Color Nodes' } }],
      }),
    });
    const sheet = await createRes.json();
    if (!sheet.spreadsheetId) return Response.json({ error: 'Failed to create spreadsheet' }, { status: 500 });
    const spreadsheetId = sheet.spreadsheetId;
    const sheetId = sheet.sheets[0].properties.sheetId;

    // Build rows
    const clampByte = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const semanticCode = (n) => {
      const bx = clampByte((n.x + 255) / 2);
      const by = clampByte(n.y);
      const bz = clampByte(n.z);
      return [bx, by, bz].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('');
    };
    const headers = ['Tier', 'Name', 'Hex', 'Semantic Code', 'X (Cool–Warm)', 'Y (Abstract–Diff)', 'Z (Muted–Vivid)', 'Parents (Hierarchy)', 'Synonyms', 'Opposites', 'Semantic Labels'];
    const rows = nodes.map(n => [
      n.tier || 'shade',
      n.name,
      n.hex,
      semanticCode(n),
      n.x,
      n.y,
      n.z,
      (n.parents || []).join(', '),
      (n.synonyms || []).join(', '),
      (n.opposites || []).join(', '),
      (n.semantic_labels || []).join(', '),
    ]);

    // Write values
    const range = 'A1';
    const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [headers, ...rows] }),
    });
    await writeRes.json();

    // Format header row (bold + frozen)
    const batchRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length },
              cell: { userEnteredFormat: { textFormat: { bold: true } } },
              fields: 'userEnteredFormat.textFormat.bold',
            },
          },
          { freeze: { sheetId, startRowIndex: 1, startColumnIndex: 0 } },
        ],
      }),
    });
    await batchRes.json();

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return Response.json({ url, count: nodes.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});