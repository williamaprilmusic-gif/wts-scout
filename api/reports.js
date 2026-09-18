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
      const rows = playerId
        ? await sql`select * from scouting_reports where workspace_id = ${workspaceId} and player_id = ${playerId}::uuid order by created_at desc`
        : await sql`select * from scouting_reports where workspace_id = ${workspaceId} order by created_at desc`;
      return response?.status ? response.status(200).json(rows) : json(rows);
    }

    if (request.method === 'POST') {
      if (!['owner', 'scout', 'analyst'].includes(auth.workspace.role)) {
        return json({ error: 'You do not have permission to create scouting reports.' }, 403);
      }
      const body = await bodyOf(request);
      const playerId = body.playerId || body.player_id;
      const report = body.report || body;
      if (!playerId || !report.title) return json({ error: 'playerId and report.title are required.' }, 400);
      if (JSON.stringify(report).length > 500000) return json({ error: 'Report payload is too large.' }, 400);
      const [player] = await sql`select id from player_profiles where id = ${playerId}::uuid and workspace_id = ${workspaceId} limit 1`;
      if (!player) return json({ error: 'Player is not in your workspace.' }, 404);
      const [row] = await sql`
        insert into scouting_reports (workspace_id, player_id, title, content, fit_score)
        values (${workspaceId}, ${playerId}::uuid, ${report.title}, ${JSON.stringify(report.content ?? report)}::jsonb, ${report.fitScore ?? report.fit_score ?? null})
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
