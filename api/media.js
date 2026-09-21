import { get } from '@vercel/blob';
import { db, json } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return response.status(503).json({ error: 'Vercel Blob is not configured.' });

  try {
    const auth = await requireAuth(request);
    const url = new URL(request.url);
    const pathname = url.searchParams.get('pathname') || '';
    const playerId = url.searchParams.get('playerId') || '';

    if (!validUuid(playerId)) return json({ error: 'A valid playerId is required.' }, 400);
    if (!pathname || pathname.length > 1024) return json({ error: 'A valid media pathname is required.' }, 400);

    const expectedPrefix = `players/${auth.user.id}/${playerId}/`;
    if (!pathname.startsWith(expectedPrefix)) return json({ error: 'Media access denied.' }, 403);

    const sql = db();
    const [player] = await sql`
      select id from player_profiles
      where id = ${playerId}::uuid and workspace_id = ${auth.workspace.id}
      limit 1
    `;
    if (!player) return json({ error: 'Player is not in your workspace.' }, 404);

    const blob = await get(pathname, { access: 'private' });
    if (!blob || blob.statusCode !== 200 || !blob.stream) return json({ error: 'Media not found.' }, 404);

    const headers = new Headers();
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Content-Type', blob.blob.contentType || 'application/octet-stream');
    if (blob.blob.size != null) headers.set('Content-Length', String(blob.blob.size));
    return new Response(blob.stream, { status: 200, headers });
  } catch (error) {
    console.error('WTS private media delivery error', error);
    const status = error?.status || 500;
    if (response?.status) return response.status(status).json({ error: status === 401 ? 'Authentication required.' : 'Unable to access media.' });
    return json({ error: 'Unable to access media.' }, status);
  }
}
