import { db, json, methodNotAllowed, serverError, workspaceIdFrom } from './_lib/db.js';

export default async function handler(request, response) {
  try {
    const sql = db();
    if (request.method === 'GET') {
      const workspaceId = workspaceIdFrom(request);
      const url = new URL(request.url);
      const playerId = url.searchParams.get('playerId');
      const rows = playerId
        ? await sql`select * from scouting_reports where workspace_id = ${workspaceId} and player_id = ${playerId}::uuid order by created_at desc`
        : await sql`select * from scouting_reports where workspace_id = ${workspaceId} order by created_at desc`;
      return response?.status ? response.status(200).json(rows) : json(rows);
    }

    if (request.method === 'POST') {
      const body = request.body || await request.json();
      const workspaceId = workspaceIdFrom(request, body);
      const playerId = body.playerId || body.player_id;
      const report = body.report || body;
      if (!playerId || !report.title) return json({ error: 'playerId and report.title are required.' }, 400);
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
    if (response?.status) return response.status(500).json(await result.json());
    return result;
  }
}
