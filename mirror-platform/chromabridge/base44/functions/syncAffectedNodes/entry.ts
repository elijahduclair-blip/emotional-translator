import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const windowMinutes = body.window_minutes || 16;
    const maxSync = body.max_sync || 50;

    // Calculate cutoff timestamp for recently-updated nodes
    const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

    // Fetch nodes updated within the window (affected by cleanse/connect)
    let affected: any[] = [];
    let skip = 0;
    while (true) {
      const batch = await base44.asServiceRole.entities.ColorNode.filter(
        { updated_date: { $gte: since } },
        '-updated_date',
        500,
        skip
      );
      affected.push(...batch);
      if (batch.length < 500) break;
      skip += 500;
    }

    if (affected.length === 0) {
      return Response.json({ success: true, synced: 0, message: 'No affected nodes in window' });
    }

    // Sync each affected node to the Google Sheet via syncConceptToSheet
    const toSync = affected.slice(0, maxSync);
    let synced = 0;
    let errors = 0;
    const errorDetails: any[] = [];

    for (const node of toSync) {
      try {
        await base44.asServiceRole.functions.invoke('syncConceptToSheet', {
          node,
          entity_id: node.id,
          event_type: 'update',
        });
        synced++;
      } catch (err) {
        errors++;
        if (errorDetails.length < 10) {
          errorDetails.push({ node: node.name, error: err.message });
        }
      }
    }

    return Response.json({
      success: true,
      window_minutes: windowMinutes,
      affected_count: affected.length,
      synced,
      errors,
      remaining: Math.max(0, affected.length - maxSync),
      error_details: errorDetails,
    });
  } catch (error) {
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});