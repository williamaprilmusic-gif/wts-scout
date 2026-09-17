import { handleUpload } from '@vercel/blob/client';
import { db } from './_lib/db.js';
import { requireAuth } from './_lib/auth.js';

const allowedContentTypes = [
  'image/jpeg', 'image/png', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'application/pdf',
];

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function bodyOf(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  return request.json();
}

export default async function handler(request, response) {
  try {
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
    if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) return response.status(503).json({ error: 'Vercel Blob is not configured.' });

    const auth = await requireAuth(request);
    const body = await bodyOf(request);
    const clientPayload = body?.payload || body?.clientPayload;
    let supplied = {};
    try { supplied = clientPayload ? JSON.parse(clientPayload) : {}; } catch { return response.status(400).json({ error: 'Invalid upload payload.' }); }
    if (!validUuid(supplied.playerId)) return response.status(400).json({ error: 'A valid playerId is required.' });

    const sql = db();
    const [player] = await sql`select id from player_profiles where id = ${supplied.playerId}::uuid and workspace_id = ${auth.workspace.id} limit 1`;
    if (!player) return response.status(404).json({ error: 'Player is not in your workspace.' });

    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes,
        maximumSizeInBytes: 5 * 1024 * 1024 * 1024,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ workspaceId: auth.workspace.id, playerId: supplied.playerId }),
      }),
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const payload = JSON.parse(tokenPayload || '{}');
          if (!validUuid(payload.playerId) || payload.workspaceId !== auth.workspace.id) return;
          await sql`
            insert into player_media (workspace_id, player_id, file_path, blob_url, file_name, mime_type, file_size)
            values (${payload.workspaceId}, ${payload.playerId}::uuid, ${blob.pathname}, ${blob.url}, ${blob.pathname.split('/').pop()}, ${blob.contentType || null}, ${blob.size || null})
          `;
        } catch (error) {
          console.error('WTS Blob completion persistence error', error);
        }
      },
    });

    return response.status(200).json(result);
  } catch (error) {
    console.error('WTS Blob upload error', error);
    return response.status(error?.status || 400).json({ error: error instanceof Error ? error.message : 'Upload failed.' });
  }
}
