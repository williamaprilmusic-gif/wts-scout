import { handleUpload } from '@vercel/blob/client';
import { db, json } from './_lib/db.js';

const allowedContentTypes = [
  'image/jpeg', 'image/png', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4', 'application/pdf',
];

export default async function handler(request, response) {
  const body = await request.json();
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        if (!payload.workspaceId || !payload.playerId) throw new Error('workspaceId and playerId are required.');
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
          if (!process.env.DATABASE_URL) return;
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
