import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all unsynced discovery candidates (strong candidates not yet pushed)
    const candidates = await base44.asServiceRole.entities.DiscoveryCandidate.filter({ synced: { $ne: true } });
    if (!candidates || candidates.length === 0) {
      return Response.json({ message: 'No new candidates to sync', count: 0 });
    }

    // Sort by score descending — strongest first
    candidates.sort((a, b) => (b.score || 0) - (a.score || 0));

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Get the persistent discovery log sheet (or create on first run)
    const states = await base44.asServiceRole.entities.SyncState.filter({ purpose: 'discovery_log' });
    let spreadsheetId;
    let sheetUrl;

    if (states && states.length > 0 && states[0].sheet_id) {
      spreadsheetId = states[0].sheet_id;
      sheetUrl = states[0].sheet_url;
    } else {
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: { title: 'ChromaBridge Discovery Log' },
          sheets: [{ properties: { title: 'Discovery Candidates' } }],
        }),
      });
      const sheet = await createRes.json();
      if (!sheet.spreadsheetId) return Response.json({ error: 'Failed to create spreadsheet' }, { status: 500 });
      spreadsheetId = sheet.spreadsheetId;
      const sheetId = sheet.sheets[0].properties.sheetId;
      sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      const headers = ['Synced At', 'Type', 'Status', 'Score', 'Node A', 'Node A Color', 'Node B', 'Node B Color', 'Distance', 'Shared Neighbors', 'Local Density', 'Candidate ID'];
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [headers] }),
      });

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

      await base44.asServiceRole.entities.SyncState.create({
        sheet_id: spreadsheetId,
        sheet_url: sheetUrl,
        purpose: 'discovery_log',
      });
    }

    // Append all unsynced candidates as rows
    const now = new Date().toISOString();
    const rows = candidates.map(c => [
      now,
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
      c.id || '',
    ]);

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows }),
    });

    // Mark all synced candidates to prevent duplicates on next run
    await base44.asServiceRole.entities.DiscoveryCandidate.bulkUpdate(
      candidates.map(c => ({ id: c.id, synced: true }))
    );

    return Response.json({ success: true, count: candidates.length, sheet_url: sheetUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});