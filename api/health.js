import { db, isDbConfigured } from './_lib/db.js';

function configured(name) {
  return Boolean(process.env[name]);
}

function sendJson(response, data, status = 200) {
  response.setHeader('Cache-Control', 'no-store, private');
  return response.status(status).json(data);
}

async function checkDatabase() {
  if (!isDbConfigured()) {
    return { provider: 'Neon Postgres', configured: false, healthy: false, schemaReady: false };
  }

  try {
    const sql = db();
    await sql`select 1 as ok`;
    const [schema] = await sql`
      select
        to_regclass('public.app_users') is not null as users_ready,
        to_regclass('public.workspaces') is not null as workspaces_ready,
        to_regclass('public.workspace_members') is not null as memberships_ready,
        to_regclass('public.app_sessions') is not null as sessions_ready,
        to_regclass('public.player_profiles') is not null as players_ready
    `;
    const schemaReady = Boolean(
      schema?.users_ready &&
      schema?.workspaces_ready &&
      schema?.memberships_ready &&
      schema?.sessions_ready &&
      schema?.players_ready,
    );

    return { provider: 'Neon Postgres', configured: true, healthy: true, schemaReady };
  } catch (error) {
    console.error('WTS health database check failed', error);
    return { provider: 'Neon Postgres', configured: true, healthy: false, schemaReady: false };
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, { error: 'Method not allowed.' }, 405);
  }

  const database = await checkDatabase();
  const blobConfigured = configured('BLOB_READ_WRITE_TOKEN') || configured('VERCEL_OIDC_TOKEN');
  const aiConfigured = configured('AI_GATEWAY_API_KEY') || configured('VERCEL_OIDC_TOKEN');
  const blob = { provider: 'Vercel Blob', configured: blobConfigured, healthy: blobConfigured };
  const ai = { provider: 'Vercel AI Gateway', configured: aiConfigured, healthy: aiConfigured };
  const healthy = database.configured && database.healthy && database.schemaReady;

  return sendJson(
    response,
    {
      ok: healthy,
      architecture: 'GitHub → Vercel → Database → Blob Storage → AI',
      services: { database, blob, ai },
      version: '0.4.0',
      timestamp: new Date().toISOString(),
    },
    healthy ? 200 : 503,
  );
}
