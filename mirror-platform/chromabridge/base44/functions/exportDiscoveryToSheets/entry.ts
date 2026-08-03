import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled-workflow calls (no user) or admin manual triggers
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* workflow context */ }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Fetch all discovery candidates, sorted by score descending
    const candidates = await base44.asServiceRole.entities.DiscoveryCandidate.list('-score', 500);
    if (!candidates || candidates.length === 0) {
      return Response.json({ message: 'No discovery candidates to export', count: 0 });
    }

    // Create a new spreadsheet
    const ts = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: { title: `ChromaBridge Discovery Log ${ts}` },
        sheets: [{ properties: { title: 'Discovery Candidates' } }],
      }),
    });
    const sheet = await createRes.json();
    if (!sheet.spreadsheetId) return Response.json({ error: 'Failed to create spreadsheet' }, { status: 500 });
    const spreadsheetId = sheet.spreadsheetId;
    const sheetId = sheet.sheets[0].properties.sheetId;

    // Build rows
    const headers = [
      'Type', 'Status', 'Score',
      'Node A', 'Node A Color', 'Node B', 'Node B Color',
      'Distance', 'Shared Neighbors', 'Local Density'
    ];
    const rows = candidates.map(c => [
      c.type || 'bridge',
      c.status || 'pending',
      c.score != null ? Number(c.score.toFixed(4)) : 0,
      c.node_a_name || '',
      c.node_a_hex || '',
      c.node_b_name || '',
      c.node_b_hex || '',
      c.distance != null ? Number(c.distance.toFixed(2)) : 0,
      c.shared_neighbors || 0,
      c.local_density || 0,
    ]);

    // Write values
    const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [headers, ...rows] }),
    });
    await writeRes.json();

    // Format header row (bold + frozen)
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
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

    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
    return Response.json({ url, count: candidates.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});