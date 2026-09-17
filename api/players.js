import { db, json, methodNotAllowed, serverError } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';

function bodyOf(request) {
  if (request.body && typeof request.body === 'object') return Promise.resolve(request.body);
  return request.json();
}

export default async function handler(request, response) {
  try {
    const auth = await requireAuth(request, { workspaceRoles: ['owner', 'scout', 'analyst'] });
    const workspaceId = auth.workspace.id;
    const sql = db();

    if (request.method === 'GET') {
      const url = new URL(request.url);
      const q = (url.searchParams.get('q') || '').trim();
      const position = (url.searchParams.get('position') || '').trim();
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
      const body = await bodyOf(request);
      const p = body.player || body;
      if (typeof p.full_name !== 'string' || p.full_name.trim().length < 2 || p.full_name.trim().length > 160) {
        return json({ error: 'full_name must be between 2 and 160 characters.' }, 400);
      }
      const [row] = await sql`
        insert into player_profiles
        (workspace_id, full_name, age, position, secondary_position, preferred_foot, nationality, city, current_club, league, status, fit_score, minutes, goals, assists, strengths, bio, avatar_url)
        values
        (${workspaceId}, ${p.full_name.trim()}, ${p.age ?? null}, ${p.position ?? null}, ${p.secondary_position ?? null}, ${p.preferred_foot ?? null}, ${p.nationality ?? null}, ${p.city ?? null}, ${p.current_club ?? null}, ${p.league ?? null}, ${p.status ?? 'Emerging'}, ${p.fit_score ?? null}, ${p.minutes ?? 0}, ${p.goals ?? 0}, ${p.assists ?? 0}, ${Array.isArray(p.strengths) ? p.strengths : []}, ${p.bio ?? null}, ${p.avatar_url ?? null})
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
