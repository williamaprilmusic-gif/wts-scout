import { handleUpload } from '@vercel/blob/client';
import { db } from './_lib/db.js';

const allowedContentTypes = [
  'image/jpeg', 'image/png', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'application/pdf',
];

function validUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(request, response) {
  try {
    if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' });
    if (!process.env.BLOB_READ_WRITE_TOKEN) return response.status(503).json({ error: 'Vercel Blob is not configured.' });

    const body = request.body || await request.json();
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        if (!payload.workspaceId || !/^[a-zA-Z0-9_-]{8,120}$/.test(payload.workspaceId)) {
          throw new Error('A valid workspaceId is required.');
        }
        if (!validUuid(payload.playerId)) throw new Error('A valid playerId is required.');

        return {
          allowedContentTypes,
          maximumSizeInBytes: 5 * 1024 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            workspaceId: payload.workspaceId,
            playerId: payload.playerId,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        try {
          const payload = JSON.parse(tokenPayload || '{}');
          if (!process.env.DATABASE_URL || !validUuid(payload.playerId)) return;
          const sql = db();
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
    return response.status(400).json({ error: error instanceof Error ? error.message : 'Upload failed.' });
  }
}
