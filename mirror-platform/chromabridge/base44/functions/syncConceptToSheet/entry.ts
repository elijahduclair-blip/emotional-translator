import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body = {};
    try { body = await req.json(); } catch (e) { /* empty */ }
    const node = body.node || body;
    const eventType = body.event_type || 'create';
    const entityId = body.entity_id || node?.id || '';

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlesheets');

    // Get or create the persistent spreadsheet
    const existing = await base44.asServiceRole.entities.SyncState.filter({ purpose: 'concept_log' });
    let spreadsheetId;
    let sheetUrl;
    let sheetId;

    if (existing && existing.length > 0 && existing[0].sheet_id) {
      spreadsheetId = existing[0].sheet_id;
      sheetUrl = existing[0].sheet_url;
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`);
      const meta = await metaRes.json();
      sheetId = meta.sheets?.[0]?.properties?.sheetId ?? 0;
    } else {
      // Create the persistent spreadsheet on first run
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: { title: 'ChromaBridge Concept Node Log' },
          sheets: [{ properties: { title: 'Concept Nodes' } }],
        }),
      });
      const sheet = await createRes.json();
      if (!sheet.spreadsheetId) return Response.json({ error: 'Failed to create spreadsheet' }, { status: 500 });
      spreadsheetId = sheet.spreadsheetId;
      sheetId = sheet.sheets[0].properties.sheetId;
      sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

      const headers = ['Last Updated', 'Name', 'Hex', 'Tier', 'X (Abstract–Concrete)', 'Y (General–Specific)', 'Z (Passive–Active)', 'Parents', 'Semantic Labels', 'Node ID'];
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
        purpose: 'concept_log',
      });
    }

    // Helper to build a row from node data
    const buildRow = (n) => [
      new Date().toISOString(),
      n.name || '',
      n.hex || '',
      n.tier || 'shade',
      n.x ?? 0,
      n.y ?? 0,
      n.z ?? 0,
      Array.isArray(n.parents) ? n.parents.join(', ') : '',
      Array.isArray(n.semantic_labels) ? n.semantic_labels.join(', ') : '',
      n.id || entityId,
    ];

    // Read all existing rows to find matching Node ID (column J = index 9)
    const readRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:J`, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    const sheetData = await readRes.json();
    const rows = sheetData.values || [];

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] && rows[i][9] === entityId) {
        rowIndex = i + 1; // 1-based sheet row number
        break;
      }
    }

    if (eventType === 'delete') {
      if (rowIndex > 0) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: rowIndex - 1,
                  endIndex: rowIndex,
                },
              },
            }],
          }),
        });
      }
      return Response.json({ success: true, action: 'deleted', node_id: entityId, sheet_url: sheetUrl });
    }

    // create or update (upsert)
    const rowData = buildRow(node);
    if (rowIndex > 0) {
      // Update existing row
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A${rowIndex}:J${rowIndex}?valueInputOption=RAW`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [rowData] }),
      });
      return Response.json({ success: true, action: 'updated', node: node.name, sheet_url: sheetUrl });
    } else {
      // Append new row
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A2:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [rowData] }),
      });
      return Response.json({ success: true, action: 'created', node: node.name, sheet_url: sheetUrl });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});