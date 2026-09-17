import { db, json, methodNotAllowed, serverError, workspaceIdFrom } from './_lib/db.js';

export default async function handler(request, response) {
  try {
    const sql = db();
    if (request.method === 'GET') {
      const workspaceId = workspaceIdFrom(request);
      const url = new URL(request.url);
      const playerId = url.searchParams.get('playerId');
      if (!playerId) return json({ error: 'playerId is required.' }, 400);
      const rows = await sql`
        select * from scouting_notes
        where workspace_id = ${workspaceId} and player_id = ${playerId}::uuid
        order by created_at desc
      `;
      return response?.status ? response.status(200).json(rows) : json(rows);
    }

    if (request.method === 'POST') {
      const body = request.body || await request.json();
      const workspaceId = workspaceIdFrom(request, body);
      const playerId = body.playerId || body.player_id;
      if (!playerId || !body.note) return json({ error: 'playerId and note are required.' }, 400);
      const [row] = await sql`
        insert into scouting_notes (workspace_id, player_id, note, stage)
        values (${workspaceId}, ${playerId}::uuid, ${body.note}, ${body.stage || 'watching'})
        returning *
      `;
      return response?.status ? response.status(201).json(row) : json(row, 201);
    }

    return methodNotAllowed('GET or POST');
  } catch (error) {
    const result = serverError(error);
    if (response?.status) return response.status(500).json(await result.json());
    return result;
  }
}
