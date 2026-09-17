import { db, json, methodNotAllowed, serverError, workspaceIdFrom } from './_lib/db.js';

export default async function handler(request, response) {
  try {
    const sql = db();
    if (request.method === 'GET') {
      const workspaceId = workspaceIdFrom(request);
      const rows = await sql`select player_id from watchlists where workspace_id = ${workspaceId} order by created_at desc`;
      const data = rows.map(row => row.player_id);
      return response?.status ? response.status(200).json(data) : json(data);
    }

    const body = request.body || await request.json();
    const workspaceId = workspaceIdFrom(request, body);
    if (!body.playerId && !body.player_id) {
      return response?.status ? response.status(400).json({ error: 'playerId is required.' }) : json({ error: 'playerId is required.' }, 400);
    }
    const playerId = body.playerId || body.player_id;

    if (request.method === 'POST') {
      const [row] = await sql`
        insert into watchlists (workspace_id, player_id)
        values (${workspaceId}, ${playerId}::uuid)
        on conflict (workspace_id, player_id) do update set player_id = excluded.player_id
        returning *
      `;
      return response?.status ? response.status(201).json(row) : json(row, 201);
    }

    if (request.method === 'DELETE') {
      await sql`delete from watchlists where workspace_id = ${workspaceId} and player_id = ${playerId}::uuid`;
      return response?.status ? response.status(200).json({ ok: true }) : json({ ok: true });
    }

    return methodNotAllowed('GET, POST or DELETE');
  } catch (error) {
    const result = serverError(error);
    if (response?.status) return response.status(500).json(await result.json());
    return result;
  }
}
