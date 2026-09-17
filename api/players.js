import { db, json, methodNotAllowed, serverError, workspaceIdFrom } from './_lib/db.js';

export default async function handler(request, response) {
  try {
    if (request.method === 'GET') {
      const workspaceId = workspaceIdFrom(request);
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') || '').trim();
      const position = (url.searchParams.get('position') || '').trim();
      const sql = db();
      const rows = q || position
        ? await sql`
            select * from player_profiles
            where workspace_id = ${workspaceId}
              and (${q} = '' or to_tsvector('simple', coalesce(full_name,'') || ' ' || coalesce(position,'') || ' ' || coalesce(nationality,'') || ' ' || coalesce(current_club,'')) @@ plainto_tsquery('simple', ${q}))
              and (${position} = '' or position = ${position})
            order by created_at desc
          `
        : await sql`select * from player_profiles where workspace_id = ${workspaceId} order by created_at desc`;
      return response?.status ? response.status(200).json(rows) : json(rows);
    }

    if (request.method === 'POST') {
      const body = request.body || await request.json();
      const workspaceId = workspaceIdFrom(request, body);
      const p = body.player || body;
      if (!p.full_name) return response?.status ? response.status(400).json({ error: 'full_name is required.' }) : json({ error: 'full_name is required.' }, 400);
      const sql = db();
      const [row] = await sql`
        insert into player_profiles
        (workspace_id, full_name, age, position, secondary_position, preferred_foot, nationality, city, current_club, league, status, fit_score, minutes, goals, assists, strengths, bio, avatar_url)
        values
        (${workspaceId}, ${p.full_name}, ${p.age ?? null}, ${p.position ?? null}, ${p.secondary_position ?? null}, ${p.preferred_foot ?? null}, ${p.nationality ?? null}, ${p.city ?? null}, ${p.current_club ?? null}, ${p.league ?? null}, ${p.status ?? 'Emerging'}, ${p.fit_score ?? null}, ${p.minutes ?? 0}, ${p.goals ?? 0}, ${p.assists ?? 0}, ${p.strengths ?? []}, ${p.bio ?? null}, ${p.avatar_url ?? null})
        returning *
      `;
      return response?.status ? response.status(201).json(row) : json(row, 201);
    }

    return methodNotAllowed('GET or POST');
  } catch (error) {
    const result = serverError(error);
    if (response?.status) {
      const payload = await result.json();
      return response.status(500).json(payload);
    }
    return result;
  }
}
