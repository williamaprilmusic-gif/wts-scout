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
    return {
      provider: 'Neon Postgres',
      configured: false,
      healthy: false,
      schemaReady: false,
      requiredTables: {},
    };
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
        to_regclass('public.player_profiles') is not null as players_ready,
        to_regclass('public.watchlists') is not null as watchlists_ready,
        to_regclass('public.scouting_notes') is not null as notes_ready,
        to_regclass('public.scouting_reports') is not null as reports_ready,
        to_regclass('public.player_media') is not null as media_ready
    `;

    const requiredTables = {
      app_users: Boolean(schema?.users_ready),
      workspaces: Boolean(schema?.workspaces_ready),
      workspace_members: Boolean(schema?.memberships_ready),
      app_sessions: Boolean(schema?.sessions_ready),
      player_profiles: Boolean(schema?.players_ready),
      watchlists: Boolean(schema?.watchlists_ready),
      scouting_notes: Boolean(schema?.notes_ready),
      scouting_reports: Boolean(schema?.reports_ready),
      player_media: Boolean(schema?.media_ready),
    };

    const schemaReady = Object.values(requiredTables).every(Boolean);
    return {
      provider: 'Neon Postgres',
      configured: true,
      healthy: true,
      schemaReady,
      requiredTables,
    };
  } catch (error) {
    console.error('WTS health database check failed', error);
    return {
      provider: 'Neon Postgres',
      configured: true,
      healthy: false,
      schemaReady: false,
      requiredTables: {},
    };
  }
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, { error: 'Method not allowed.' }, 405);
  }

  const database = await checkDatabase();
  const blobTokenConfigured = configured('BLOB_READ_WRITE_TOKEN') || configured('VERCEL_OIDC_TOKEN');
  const blobStoreConfigured = configured('BLOB_STORE_ID') || configured('BLOB_READ_WRITE_TOKEN');
  const aiConfigured = configured('AI_GATEWAY_API_KEY') || configured('VERCEL_OIDC_TOKEN');
  const blobConfigured = blobTokenConfigured && blobStoreConfigured;
  const blob = {
    provider: 'Vercel Blob',
    configured: blobConfigured,
    healthy: blobConfigured,
    auth: configured('BLOB_READ_WRITE_TOKEN') ? 'api-key' : configured('VERCEL_OIDC_TOKEN') ? 'oidc' : 'missing',
    store: blobStoreConfigured ? 'connected' : 'missing',
  };
  const ai = {
    provider: 'Vercel AI Gateway',
    configured: aiConfigured,
    healthy: aiConfigured,
    auth: configured('AI_GATEWAY_API_KEY') ? 'api-key' : configured('VERCEL_OIDC_TOKEN') ? 'oidc' : 'missing',
  };
  const healthy = database.configured && database.healthy && database.schemaReady && blob.healthy && ai.healthy;

  return sendJson(
    response,
    {
      ok: healthy,
      architecture: 'GitHub → Vercel → Database → Blob Storage → AI',
      services: { database, blob, ai },
      version: '0.4.1',
      timestamp: new Date().toISOString(),
    },
    healthy ? 200 : 503,
  );
}
