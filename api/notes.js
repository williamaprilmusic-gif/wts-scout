import { db, json, methodNotAllowed, serverError } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';

async function bodyOf(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  return request.json();
}

export default async function handler(request, response) {
  try {
    const auth = await requireAuth(request);
    const workspaceId = auth.workspace.id;
    const sql = db();

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const playerId = url.searchParams.get('playerId');
      if (!playerId || !/^[0-9a-fA-F-]{36}$/.test(playerId)) return json({ error: 'A valid playerId is required.' }, 400);
      const rows = await sql`
        select * from scouting_notes
        where workspace_id = ${workspaceId} and player_id = ${playerId}::uuid
        order by created_at desc
      `;
      return response?.status ? response.status(200).json(rows) : json(rows);
    }

    if (request.method === 'POST') {
      if (!['owner', 'scout', 'analyst'].includes(auth.workspace.role)) {
        return json({ error: 'You do not have permission to create scouting notes.' }, 403);
      }
      const body = await bodyOf(request);
      const playerId = body.playerId || body.player_id;
      if (!playerId || !/^[0-9a-fA-F-]{36}$/.test(playerId) || typeof body.note !== 'string' || !body.note.trim()) return json({ error: 'A valid playerId and note are required.' }, 400);
      if (body.note.length > 10000) return json({ error: 'Scout note is too long.' }, 400);
      const allowedStages = new Set(['watching', 'shortlist', 'contacted', 'trial', 'signed', 'rejected']);
      if (body.stage !== undefined && !allowedStages.has(body.stage)) return json({ error: 'Invalid scouting stage.' }, 400);
      const [player] = await sql`select id from player_profiles where id = ${playerId}::uuid and workspace_id = ${workspaceId} limit 1`;
      if (!player) return json({ error: 'Player is not in your workspace.' }, 404);
      const [row] = await sql`
        insert into scouting_notes (workspace_id, player_id, note, stage)
        values (${workspaceId}, ${playerId}::uuid, ${body.note.trim()}, ${body.stage || 'watching'})
        returning *
      `;
      return response?.status ? response.status(201).json(row) : json(row, 201);
    }

    return methodNotAllowed('GET or POST');
  } catch (error) {
    const result = serverError(error);
    const status = error?.status || 500;
    if (response?.status) return response.status(status).json(await result.json());
    return result;
  }
}
